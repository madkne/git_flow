import { ConfigKey, IntegrationType, PathInfo } from "./types";
import * as ENV from '@dat/lib/env';
import * as INPUT from '@dat/lib/input';
import { Gitlab } from '@gitbeaker/node';
import * as LOG from "@dat/lib/log";

export async function selectPath() {
    let addNewPathKey = 'add_path';
    // =>load last path selected
    let lastPath = await config('last_path_name');
    // =>get all saved paths
    let savedPaths = await ENV.load<PathInfo[]>('paths', []);
    let options = [];
    for (const pt of savedPaths) {
        options.push({
            text: pt.name,
            value: pt.name,
        });
    }
    // =>add 'new path' option
    options.push({
        text: 'Add new Path',
        value: addNewPathKey,
    });
    // =>select path for git
    let pathName = await INPUT.select('select a saved path or add new path', options, lastPath ? lastPath : addNewPathKey);
    // =>if want to add new path
    if (pathName === addNewPathKey) {
        await addNewPath();
    } else {
        // =>set last path
        await setConfig('last_path_name', pathName);
    }
    // =>map name to path
    let pathInfo = savedPaths.find(i => i.name === pathName);

    return pathInfo;
}
/***************************************** */
async function addNewPath() {
    // =>get all saved paths
    let savedPaths = await ENV.load<PathInfo[]>('paths', []);
    let projectName = await INPUT.input('Enter name of your new project');
    let projectPath = await INPUT.input('Enter path of your new project');
    let projectDevBranch = await INPUT.input('Enter dev branch name of your new project (default "dev")', 'dev');
    let projectMasterBranch = await INPUT.input('Enter master branch name of your new project (default "master")', 'master');
    let projectRemoteName = await INPUT.input('Enter remote name of your new project (default "origin")', 'origin');
    let newPath: PathInfo = {
        name: projectName,
        path: projectPath,
        devBranch: projectDevBranch,
        masterBranch: projectMasterBranch,
        remoteName: projectRemoteName,
    };
    let integrations: IntegrationType[] = [];
    // =>use gitlab
    if (await INPUT.boolean('Are you use gitlab integration?')) {
        integrations.push('gitlab');
        let gitlabProjectName = await INPUT.input('Enter name of your project in gitlab', projectName);
        LOG.info(`searching for ${gitlabProjectName} project in gitlab...`);
        // console.log(findProjects)
        // =>select gitlab project, if exist
        if (await config('gitlab_access_token')) {
            let api = await getGitlabInstance();
            let findProjects = await api.Projects.search(gitlabProjectName);
            let gitlabProjects = findProjects.map(i => {
                return {
                    text: i.name,
                    value: String(i.id),
                };
            });
            // =>add not project
            gitlabProjects.push({
                text: 'Not Selected Project',
                value: "0",
            })
            let gitlabProjectId = await INPUT.select('Select gitlab project', gitlabProjects);
            newPath.gitlabProjectId = gitlabProjectId ? Number(gitlabProjectId) : undefined;
        }
    }
    // =>use redmine
    if (await INPUT.boolean('Are you use redmine integration?')) {
        integrations.push('redmine');
        // newPath.redmineProjectName = await INPUT.input('Enter name of your project in redmine', projectName);
        // newPath.redmineUsername = await INPUT.input('Enter your username in redmine');
        // newPath.redminePassword = await INPUT.password('Enter your password in redmine');
    }
    newPath.integrations = integrations;
    // =>save new path
    savedPaths.push(newPath);
    await setConfig('paths', savedPaths);
    // =>set last path
    await setConfig('last_path_name', projectName);

}
/***************************************** */
export async function config<T = any>(key: ConfigKey, def?: T) {
    return await ENV.load(key, def) as T;
}
/***************************************** */
export async function setConfig(key: ConfigKey, value: any) {
    return await ENV.save(key, value);
}

/***************************************** */
export async function getGitlabInstance() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const api = new Gitlab({
        token: await config('gitlab_access_token'),
        host: await config('gitlab_hostname'),
    });
    return api;
}

export const branchPrefixes = {
    feature: 'feature',
    hotfix: 'hotfix',
    release: 'release',
    tests: 'tests',
};

export const BranchSplitter = '/';