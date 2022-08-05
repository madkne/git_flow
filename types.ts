export type BranchType = 'feature' | 'hotfix' | 'release';
export type ConfigKey = 'gitlab_access_token' | 'gitlab_hostname' | 'last_path_name' | 'paths' | 'redmine_issues';
export interface PathInfo {
    name: string;
    path: string;
    devBranch: string;
    masterBranch: string;
    remoteName: string;
    integrations?: IntegrationType[];
    // =>gitlab
    gitlabProjectId?: number;
    // =>redmine
    // redmineProjectName?: string;
    // redmineUsername?: string;
    // redminePassword?: string;
}
export type CommandArgvName = 'no-update' | 'show-commands';
export type CommandName = 'init' | 'close';

export type IntegrationType = 'gitlab' | 'redmine';

export interface RedmineIssue {
    pathName: string;
    issueId: number;
    statusId: number;
    branchName: string;
    activityId: number;
    lastCommit?: string;
    lastTimeLog?: number;
}