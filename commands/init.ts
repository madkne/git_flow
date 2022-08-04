import { BaseCommandName, CliCommand, OnImplement, cliCommandItem, CommandArgvItem } from '@dat/lib/argvs';
import { branchPrefixes, BranchSplitter, config, selectPath, setConfig } from '../common';
import { BranchType, CommandArgvName, CommandName, PathInfo, RedmineIssue } from '../types';
import * as INPUT from '@dat/lib/input';
import * as LOG from "@dat/lib/log";
import * as OS from '@dat/lib/os';
import * as TEM from '@dat/lib/template';
import * as NET from '@dat/lib/net';
import * as path from 'path';
import * as fs from 'fs';
import * as ENV from '@dat/lib/env';
import { BehaviorSubject } from 'rxjs';

@cliCommandItem()
export class InitCommand extends CliCommand<CommandName, CommandArgvName> implements OnImplement {
    redmineIssueId: number;
    path: PathInfo;
    command = new BehaviorSubject<string>(undefined);


    get name(): CommandName {
        return 'init';
    }

    get description(): string {
        return 'init a branch by select type';
    }

    get alias(): string {
        return 'i';
    }


    get argvs(): CommandArgvItem<CommandArgvName>[] {
        return [
            {
                name: 'no-update',
                description: 'not pull from remote server to update parent branch',
                alias: 'n1',
            },
            {
                name: 'show-commands',
                description: 'show all commands that execute on console',
                alias: 's1',
            }
        ]
    }

    constructor() {
        super();
        this.command.subscribe(it => {
            if (!this.hasArgv('show-commands') || !it) return;
            LOG.warning(it);
        });
    }

    async implement(): Promise<boolean> {
        // console.log(await ENV.loadEnvFile());
        // =>get path
        this.path = await selectPath();
        // =>select type of branch
        let branchType = await INPUT.select('select a branch type', ['feature',
            'release', 'hotfix'], 'feature') as BranchType;
        // =>integration with redmine
        if (this.path.integrations.find(i => i == 'redmine')) {
            await this.setupRedmine();
        }
        // =>create new branch by type
        switch (branchType) {
            case 'feature':
                return await this.createFeatureBranch();
            case 'release':
                return await this.createReleaseBranch();
            case 'hotfix':
                return await this.createHotfixBranch();
            default:
                break;
        }
        return true;
    }

    async createFeatureBranch() {
        // =>get new feature name
        let name = await INPUT.input('Enter new feature name (default "feature")', 'feature');
        return await this.createBranch(this.path.devBranch, `${branchPrefixes.feature}${BranchSplitter}${name}`);
    }
    /***************************************** */
    async createReleaseBranch() {
        // =>get new version tag
        let tag = await INPUT.input('Enter new version tag (default "0.1.0")', '0.1.0');
        return await this.createBranch(this.path.devBranch, `${branchPrefixes.release}${BranchSplitter}${tag}`);
    }
    /***************************************** */
    async createHotfixBranch() {
        // =>get new version tag
        let tag = await INPUT.input('Enter new version hotfix (default "0.1.1")', '0.1.1');
        return await this.createBranch(this.path.masterBranch, `${branchPrefixes.hotfix}${BranchSplitter}${tag}`);
    }
    /***************************************** */
    async createBranch(parentBranch: string, newBranch: string) {
        // =>integration with redmine
        if (this.path.integrations.find(i => i == 'redmine')) {
            newBranch = `${newBranch}#${this.redmineIssueId}`;
            // =>add post-commit hook to project git
            let res0 = await TEM.saveRenderFile(path.join(await OS.cwd(), 'data', 'templates', 'post-commit'), path.join(this.path.path, '.git', 'hooks'), {
                data: {
                    dataPath: path.join(await OS.cwd(), 'data'),
                    fileName: 'redmine',
                    param1: String(this.redmineIssueId),
                    param2: process.env.redmine_hostname,
                    param3: process.env.redmine_api_key,
                }, noCache: true
            });
            this.command.next(`chmod +x .git/hooks/post-commit`);
            await OS.shell(this.command.getValue(), this.path.path);
            // =>select a activity
            let activities = await this.getRedmineActivities();
            let activityId = await INPUT.select('select an activity (for use log times)', activities.map(i => {
                return {
                    text: i.name,
                    value: String(i.id),
                };
            }));
            // =>add new redmine issue to configs
            let redmineIssues = await config<RedmineIssue[]>('redmine_issues', []);
            // =>check exist issue before, remove it
            if (redmineIssues.find(i => i.issueId === this.redmineIssueId)) {
                redmineIssues.splice(redmineIssues.findIndex(i => i.issueId === this.redmineIssueId), 1);
            }
            redmineIssues.push({
                issueId: this.redmineIssueId,
                pathName: this.path.name,
                lastTimeLog: new Date().getTime(),
                branchName: newBranch,
                activityId: Number(activityId),
            });
            await setConfig('redmine_issues', redmineIssues);
        }
        // =>checkout to parent branch
        this.command.next(`git checkout ${parentBranch}`);
        let res1 = await OS.shell(this.command.getValue(), this.path.path);
        if (res1 !== 0) return false;
        // =>update parent branch, if allowed
        if (!this.hasArgv('no-update')) {
            this.command.next(`git pull ${this.path.remoteName} ${parentBranch}`);
            let res2 = await OS.shell(this.command.getValue(), this.path.path);
            if (res2 !== 0) return false;
        }
        // =>create new branch
        this.command.next(`git checkout -b ${newBranch}`);
        let res3 = await OS.shell(this.command.getValue(), this.path.path);
        if (res3 !== 0) return false;
        LOG.success(`created '${newBranch}' branch successfully`);

    }
    /***************************************** */
    async setupRedmine() {
        this.redmineIssueId = Number(await INPUT.input('Enter issue id (redmine)'));
        if (isNaN(this.redmineIssueId)) {
            throw new Error("issue id must be number");

        }
    }
    /***************************************** */
    async getRedmineActivities() {
        let res = await NET.request<{ time_entry_activities: { id: number, name: string }[] }>({
            url: process.env.redmine_hostname + '/enumerations/time_entry_activities.json',
            headers: {
                // 'X-Redmine-API-Key': process.env.redmine_api_key,
            }
        });
        // console.log(res.data.time_entry_activities)
        return res.data.time_entry_activities;

    }
}