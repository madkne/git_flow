import * as LOG from "@dat/lib/log";
import * as ENV from '@dat/lib/env';
import * as INPUT from '@dat/lib/input';
import * as ARGVS from '@dat/lib/argvs';
import * as OS from '@dat/lib/os';
import { Gitlab } from '@gitbeaker/node';

type BranchType = 'feature' | 'hotfix' | 'release';
type ConfigKey = 'gitlab_access_token' | 'gitlab_hostname' | 'last_path_name' | 'paths';
interface PathInfo {
   name: string;
   path: string;
   devBranch: string;
   masterBranch: string;
   remoteName: string;
   gitlabProjectId?: number;
}
const branchPrefixes = {
   feature: 'feature',
   hotfix: 'hotfix',
   release: 'release',
};
const VERSION = '0.3';
/***************************************** */
export async function main(): Promise<number> {
   // =>load all default configs
   await loadDefaultConfigs();
   ARGVS.define([
      {
         name: 'init',
         description: 'init a branch by select type',
         alias: 'i',
         implement: async () => { return await init(); }
      },
      {
         name: 'close',
         description: 'close a branch',
         alias: 'c',
         implement: async () => { return await close(); }
      },
   ]);
   return 0;
}

/***************************************** */
async function init() {
   // =>get path
   let path = await selectPath();
   // =>select type of branchadd
   let branchType = await INPUT.select('select a branch type', ['feature',
      'release'], 'feature') as BranchType;
   // =>create new branch by type
   switch (branchType) {
      case 'feature':
         return await createFeatureBranch(path);
      case 'release':
         return await createReleaseBranch(path);
      default:
         break;
   }
   return true;
}
/***************************************** */
async function createFeatureBranch(path: PathInfo) {
   // =>get new feature name
   let name = await INPUT.input('Enter new feature name (default "feature")', 'feature');
   // =>checkout to dev branch
   let res1 = await OS.shell(`git checkout ${path.devBranch}`, path.path);
   if (res1 !== 0) return false;
   // =>update dev branch
   // LOG.log(`git pull ${path.remoteName} ${path.devBranch}`)
   let res2 = await OS.shell(`git pull ${path.remoteName} ${path.devBranch}`, path.path);
   if (res2 !== 0) return false;
   // console.log('res1', res1)
   // =>create new feature branch
   let res3 = await OS.shell(`git checkout -b ${branchPrefixes.feature}_${name}`, path.path);
   if (res3 !== 0) return false;
   LOG.success(`created '${branchPrefixes.feature}_${name}' branch successfully`);
}
/***************************************** */
async function createReleaseBranch(path: PathInfo) {
   // =>get new version tag
   let tag = await INPUT.input('Enter new version tag (default "0.1.0")', '0.1.0');
   // =>checkout to dev branch
   let res1 = await OS.shell(`git checkout ${path.devBranch}`, path.path);
   if (res1 !== 0) return false;
   // =>update dev branch
   // LOG.log(`git pull ${path.remoteName} ${path.devBranch}`)
   let res2 = await OS.shell(`git pull ${path.remoteName} ${path.devBranch}`, path.path);
   if (res2 !== 0) return false;
   // console.log('res1', res1)
   // =>create new release branch
   let res3 = await OS.shell(`git checkout -b ${branchPrefixes.release}_${tag}`, path.path);
   if (res3 !== 0) return false;
   LOG.success(`created '${branchPrefixes.release}_${tag}' branch successfully`);

}
/***************************************** */
async function close() {
   // =>get path
   let path = await selectPath();
   // =>get current branch name
   let res1 = await OS.exec(`git rev-parse --abbrev-ref HEAD`, path.path);
   // console.log(res1)
   if (res1.code !== 0) return false;
   let branchName = String(res1.stdout);
   // =>detect type by current branch prefix
   let type: BranchType;
   if (branchName.startsWith(branchPrefixes.feature + '_')) {
      type = 'feature';
      return await closeFeatureBranch(branchName, path);
   }
   if (branchName.startsWith(branchPrefixes.release + '_')) {
      type = 'release';
      return await closeReleaseBranch(branchName, path);
   }
   else if (branchName.startsWith(branchPrefixes.hotfix + '_')) {
      type = 'hotfix';
      //TODO:
   } else {
      LOG.error(`can not detect type of branch '${branchName}'`);
      return false;
   }
   return true;
}
/***************************************** */
/***************************************** */
/***************************************** */
/***************************************** */
async function closeFeatureBranch(branchName: string, path: PathInfo) {
   let commands = [
      // =>checkout to dev branch
      `git checkout ${path.devBranch}`,
      // =>update dev branch
      `git pull ${path.remoteName} ${path.devBranch}`,
      // =>checkout to current branch
      `git checkout ${branchName}`,
      // =>merge dev branch to current branch
      `git merge ${path.devBranch}`,
      // =>push current branch
      `git push ${path.remoteName} ${branchName}`,
   ];
   for (const com of commands) {
      let res1 = await OS.shell(com, path.path);
      if (res1 !== 0) return false;
   }
   LOG.success(`pushed '${branchName}' branch successfully`);
   // =>create merge request
   await mergeRequest(path, branchName, path.devBranch);
   return true;
}
/***************************************** */
async function closeReleaseBranch(branchName: string, path: PathInfo) {
   // =>get release tag value
   let tag = branchName.replace(branchPrefixes.release + '_', '');
   let commands = [
      // =>checkout to master branch
      `git checkout ${path.masterBranch}`,
      // =>update master branch
      `git pull ${path.remoteName} ${path.masterBranch}`,
      // =>checkout to current branch
      `git checkout ${branchName}`,
      // =>merge master branch to current branch
      `git merge ${path.masterBranch}`,
      // =>tag on branch
      `git tag -a v${tag}  -m "New release for v${tag}"`,
      // =>push current branch
      `git push ${path.remoteName} ${branchName}`,
   ];
   for (const com of commands) {
      let res1 = await OS.shell(com, path.path);
      if (res1 !== 0) return false;
   }
   LOG.success(`pushed '${branchName}' branch successfully`);
   // =>create merge request
   await mergeRequest(path, branchName, path.masterBranch);
   // =>if has project id
   return true;
}
/***************************************** */
async function mergeRequest(path: PathInfo, sourceBranch: string, targetBranch: string) {
   // =>if has project id
   if (path.gitlabProjectId) {
      let api = await getGitlabInstance();
      let res2 = await api.MergeRequests.create(path.gitlabProjectId, sourceBranch, targetBranch, `merge ${sourceBranch} to ${targetBranch} branch`);
      if (res2.created_at) {
         LOG.success(`created merge request from '${sourceBranch}' to '${targetBranch}' branch`);
      }
      // api.NotificationSettings.
   } else {
      LOG.info(`Now you can create merge request from '${sourceBranch}' to '${targetBranch}' branch`);
   }
}
/***************************************** */
async function selectPath() {
   let addNewPath = 'add_path';
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
      value: addNewPath,
   });
   // =>select path for git
   let pathName = await INPUT.select('select a saved path or add new path', options, lastPath ? lastPath : addNewPath);
   // =>if want to add new path
   if (pathName === addNewPath) {
      let projectName = pathName = await INPUT.input('Enter name of your new project');
      let projectPath = await INPUT.input('Enter path of your new project');
      let projectDevBranch = await INPUT.input('Enter dev branch name of your new project (default "dev")', 'dev');
      let projectMasterBranch = await INPUT.input('Enter master branch name of your new project (default "master")', 'master');
      let projectRemoteName = await INPUT.input('Enter remote name of your new project (default "origin")', 'origin');
      // console.log(findProjects)
      let gitlabProjectId;
      // =>select gitlab project, if exist
      if (await config('gitlab_access_token')) {
         let api = await getGitlabInstance();
         let findProjects = await api.Projects.search(projectName);
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
         gitlabProjectId = await INPUT.select('Select gitlab project', gitlabProjects);
      }
      // =>save new path
      savedPaths.push({
         name: projectName,
         path: projectPath,
         devBranch: projectDevBranch,
         masterBranch: projectMasterBranch,
         remoteName: projectRemoteName,
         gitlabProjectId: gitlabProjectId ? Number(gitlabProjectId) : undefined,
      });
      await setConfig('paths', savedPaths);
      // =>set last path
      await setConfig('last_path_name', projectName);
   } else {
      // =>set last path
      await setConfig('last_path_name', pathName);
   }
   // =>map name to path
   let pathInfo = savedPaths.find(i => i.name === pathName);

   return pathInfo;
}
/***************************************** */
async function config(key: ConfigKey, def?: any) {
   return await ENV.load(key, def);
}
/***************************************** */
async function setConfig(key: ConfigKey, value: any) {
   return await ENV.save(key, value);
}
/***************************************** */
async function loadDefaultConfigs() {
   if (!await config('gitlab_access_token')) {
      await setConfig('gitlab_access_token', '1TN-79SFdB7jy4wM8yKA');
   }
   if (!await config('gitlab_hostname')) {
      await setConfig('gitlab_hostname', 'https://git.hyvatech.com');
   }
}
/***************************************** */
async function getGitlabInstance() {
   process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
   const api = new Gitlab({
      token: await config('gitlab_access_token'),
      host: await config('gitlab_hostname'),
   });
   return api;
}