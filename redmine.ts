
import * as NET from '@dat/lib/net';

export namespace RedmineApi {
    export async function currentUser() {
        let res = await NET.request<{ user: { id: number, login: string; firstname: string; lastname: string; mail: string; } }>({
            url: process.env.redmine_hostname + '/users/current.json',
            headers: {
                'X-Redmine-API-Key': process.env.redmine_api_key,
            }
        });
        // console.log(res.data.time_entry_activities)
        return res.data.user;
    }
    /***************************************** */
    export async function getRedmineActivities() {
        let res = await NET.request<{ time_entry_activities: { id: number, name: string }[] }>({
            url: process.env.redmine_hostname + '/enumerations/time_entry_activities.json',
        });
        // console.log(res.data.time_entry_activities)
        return res.data.time_entry_activities;

    }
    /***************************************** */
    export async function getIssuesInfo(issues: number[]) {
        let res = await NET.request<{ issues: { id: number, tracker: { name: string; }; status: { name: string; id: number; }; subject: string; }[] }>({
            url: process.env.redmine_hostname + '/issues.json',
            body: {
                issue_id: issues.join(','),
            },
            headers: {
                'X-Redmine-API-Key': process.env.redmine_api_key,
            }
        });
        // console.log(res.data.time_entry_activities)
        return res.data.issues;
    }
    /***************************************** */
    export async function updateIssue(issueId: number, issue: object) {
        let res = await NET.request({
            url: process.env.redmine_hostname + `/issues/${issueId}.json`,
            body: {
                issue,
            },
            method: 'PUT',
            headers: {
                'X-Redmine-API-Key': process.env.redmine_api_key,
            }
        });
        // console.log(res, issue)
        return res;
    }
    /***************************************** */
    export async function getRedmineStatuses() {
        let res = await NET.request<{ issue_statuses: { id: number, name: string }[] }>({
            url: process.env.redmine_hostname + '/issue_statuses.json',
        });
        // console.log(res.data.time_entry_activities)
        return res.data.issue_statuses;

    }

}
