import { CommandArgvItem, CliCommand, OnImplement, cliCommandItem } from '@dat/lib/argvs';
import { branchPrefixes, BranchSplitter, config, getGitlabInstance, selectPath } from '../common';
import { BranchType, CommandArgvName, CommandName, PathInfo, RedmineIssue } from '../types';
import * as INPUT from '@dat/lib/input';
import * as LOG from "@dat/lib/log";
import * as OS from '@dat/lib/os';
import * as path from 'path';
import * as fs from 'fs';
import { BehaviorSubject, Subject } from 'rxjs';
import { RedmineApi } from '../redmine';

@cliCommandItem()
export class CloseCommand extends CliCommand<CommandName, CommandArgvName> implements OnImplement {
    path: PathInfo;
    branchName: string;
    command = new BehaviorSubject<string>(undefined);
    issue: RedmineIssue;

    get name(): CommandName {
        return 'close';
    }

    get description(): string {
        return 'close a branch';
    }

    get alias(): string {
        return 'c';
    }

    constructor() {
        super();
        this.command.subscribe(it => {
            if (!this.hasArgv('show-commands') || !it) return;
            LOG.warning(it);
        });
    }
    /***************************************** */

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
    /***************************************** */

    async implement(): Promise<boolean> {
        // =>get path
        this.path = await selectPath();
        // =>get current branch name
        this.command.next(`git rev-parse --abbrev-ref HEAD`);
        let res1 = await OS.exec(this.command.getValue(), this.path.path);
        // console.log(res1)
        if (res1.code !== 0) return false;
        this.branchName = String(res1.stdout);
        // =>find issue by branch name
        this.issue = (await config<RedmineIssue[]>('redmine_issues', [])).find(i => i.branchName === this.branchName);
        // console.log('issue:', this.issue)
        // =>integration with redmine
        if (this.path.integrations.find(i => i == 'redmine') && this.issue) {
            // =>remove post-commit hook
            if (fs.existsSync(path.join(this.path.path, '.git', 'hooks', 'post-commit'))) {
                fs.unlinkSync(path.join(this.path.path, '.git', 'hooks', 'post-commit'));
            }
        }
        // =>detect type by current branch prefix
        let type: BranchType;
        if (this.branchName.startsWith(branchPrefixes.feature + BranchSplitter)) {
            type = 'feature';
            return await this.closeFeatureBranch();
        }
        if (this.branchName.startsWith(branchPrefixes.release + BranchSplitter)) {
            type = 'release';
            return await this.closeReleaseBranch();
        }
        else if (this.branchName.startsWith(branchPrefixes.hotfix + BranchSplitter)) {
            type = 'hotfix';
            return await this.closeHotfixBranch();
        } else {
            LOG.error(`can not detect type of branch '${this.branchName}'`);
            return false;
        }
        return true;

    }
    /***************************************** */

    async closeFeatureBranch() {
        let commands = [
            // =>checkout to dev branch
            `git checkout ${this.path.devBranch}`,
            // =>update dev branch
            !this.hasArgv('no-update') ? `git pull ${this.path.remoteName} ${this.path.devBranch}` : undefined,
            // =>checkout to current branch
            `git checkout ${this.branchName}`,
            // =>merge dev branch to current branch
            `git merge ${this.path.devBranch}`,
            // =>push current branch
            !this.hasArgv('no-update') ? `git push ${this.path.remoteName} ${this.branchName}` : undefined,
        ];
        await this.closeCommonBranch(commands, false);
        return true;
    }
    /***************************************** */
    async closeReleaseBranch() {
        // =>get release tag value
        let tag = this.branchName.replace(branchPrefixes.release + BranchSplitter, '');
        let commands = [
            // =>checkout to master branch
            `git checkout ${this.path.masterBranch}`,
            // =>update master branch
            !this.hasArgv('no-update') ? `git pull ${this.path.remoteName} ${this.path.masterBranch}` : undefined,
            // =>checkout to current branch
            `git checkout ${this.branchName}`,
            // =>merge master branch to current branch
            `git merge ${this.path.masterBranch}`,
            // =>tag on branch
            `git tag -a v${tag}  -m "New release for v${tag}"`,
            // =>push current branch
            !this.hasArgv('no-update') ? `git push ${this.path.remoteName} ${this.branchName}` : undefined,
            // =>push tags
            !this.hasArgv('no-update') ? `git push ${this.path.remoteName} --tags` : undefined,
        ];
        await this.closeCommonBranch(commands, true);
        return true;
    }
    /***************************************** */
    async closeHotfixBranch() {
        // =>get hotfix tag value
        let tag = this.branchName.replace(branchPrefixes.hotfix + BranchSplitter, '');
        let commands = [
            // =>checkout to master branch
            `git checkout ${this.path.masterBranch}`,
            // =>update master branch
            !this.hasArgv('no-update') ? `git pull ${this.path.remoteName} ${this.path.masterBranch}` : undefined,
            // =>checkout to current branch
            `git checkout ${this.branchName}`,
            // =>merge master branch to current branch
            `git merge ${this.path.masterBranch}`,
            // =>tag on branch
            `git tag -a v${tag}  -m "new hotfix for v${tag}"`,
            // =>push current branch
            !this.hasArgv('no-update') ? `git push ${this.path.remoteName} ${this.branchName}` : undefined,
            // =>push tags
            !this.hasArgv('no-update') ? `git push ${this.path.remoteName} --tags` : undefined,
        ];
        return await this.closeCommonBranch(commands, true);
    }
    /***************************************** */
    async closeCommonBranch(commands: string[], mergeRequestOnMaster = false) {
        for (const com of commands) {
            if (com === undefined || com === '') continue;
            this.command.next(com);
            let res1 = await OS.shell(this.command.getValue(), this.path.path);
            if (res1 !== 0) return false;
        }
        if (!this.hasArgv('no-update')) {
            LOG.success(`pushed '${this.branchName}' branch successfully`);
        } else {
            LOG.success(`closed '${this.branchName}' branch successfully`);
        }
        // =>integration with redmine
        if (this.path.integrations.find(i => i == 'redmine') && this.issue) {
            // =>get all statuses
            let statuses = await RedmineApi.getRedmineStatuses();
            let targetStatus = await INPUT.select('(redmine) Update issue status', statuses.map(i => {
                return {
                    text: i.name,
                    value: String(i.id),
                };
            }));
            // =>update issue
            await RedmineApi.updateIssue(this.issue.issueId, { status_id: Number(targetStatus) });
        }
        // =>create merge request on master
        if (mergeRequestOnMaster) {
            await this.mergeRequest(this.branchName, this.path.masterBranch);
        }
        // =>create merge request on dev
        await this.mergeRequest(this.branchName, this.path.devBranch);
        return true;
    }
    /***************************************** */
    async mergeRequest(sourceBranch: string, targetBranch: string) {
        // =>if has project id
        if (this.path.integrations.find(i => i == 'gitlab')) {
            let api = await getGitlabInstance();
            let res2 = await api.MergeRequests.create(this.path.gitlabProjectId, sourceBranch, targetBranch, `merge ${sourceBranch} to ${targetBranch} branch`);
            if (res2.created_at) {
                LOG.success(`created merge request from '${sourceBranch}' to '${targetBranch}' branch`);
            }
            // api.NotificationSettings.
        } else {
            LOG.info(`Now you can create merge request from '${sourceBranch}' to '${targetBranch}' branch`);
        }
    }
}