
const fs = require('fs');
const http = require('http');

let commitMessage = process.argv[2];
let branch = process.argv[3];
let issueId = process.argv[4];
let redmineHostName = process.argv[5];
let apiKey = process.argv[6];

let resMain = main();
if (!resMain) process.exit(1);
/************************************************* */
function main() {
    // =>update commit message
    commitMessage += ` (branch: ${branch})`;
    // =>read .dat/.env file
    const envFile = JSON.parse(fs.readFileSync('../.dat/.env').toString());
    // =>find target issue struct
    let issue = envFile['redmine_issues'].find(i => i.issueId == Number(issueId));
    if (!issue) {
        log('not found issue!');
        return false;
    }
    // =>check match branch
    if (branch !== issue.branchName) {
        log(`current branch no match with '${issue.branchName}'!`);
        return false;
    }
    // =>calc time log
    let timeLogPeriod = Number(((new Date().getTime() - issue.lastTimeLog) / (1000 * 60)).toFixed(1)); //minutes
    if (timeLogPeriod < 1) {
        return true;
    }
    log(`your time spend for this commit was: ${timeLogPeriod}m`);
    // =>set log time on redmine
    // Set up the request
    let post_data = JSON.stringify({
        time_entry: {
            issue_id: Number(issueId),
            hours: Number((timeLogPeriod / 60).toFixed(2)),
            comments: commitMessage,
            activity_id: issue.activityId,
        }
    });


    const redmineUrl = new URL(redmineHostName);

    let options = {
        host: redmineUrl.hostname,
        port: redmineUrl.port,
        protocol: redmineUrl.protocol,
        path: '/time_entries.json',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Redmine-API-Key': apiKey,
            'Content-Length': post_data.length,
        }
    };
    // console.log('options:', options, post_data);
    var post_req = http.request(options, function (res) {
        let data = '';
        if (res.statusCode < 300) {
            log('saved log time!');
        }
        // console.log('Status Code:', res.statusCode);

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            // console.log('Body: ', data);
        });

    }).on("error", (err) => {
        console.log("Error: ", err.message);
    });
    // post the data
    post_req.write(post_data);
    post_req.end();
    // =>update issue struct
    let issueIndex = envFile['redmine_issues'].findIndex(i => i.issueId == Number(issueId));
    envFile['redmine_issues'][issueIndex].lastTimeLog = new Date().getTime();
    envFile['redmine_issues'][issueIndex].lastCommit = commitMessage;
    fs.writeFileSync('../.dat/.env', JSON.stringify(envFile));
    return true;
}

/************************************************* */
function log(msg) {
    console.log(`\x1b[34m\x1b[1m(redmine) ${msg}\x1b[0m`);
}
