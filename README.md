# git flow - version 1.3

manage your project with git flow script and integration with gitlab, redmine

## get started

- install `dat-tool` with `npm i -g dat-tool`
- create `.env` file from `.env.sample` file
- install dependencies with `npm i`
- create new branch:
    - command `dat p i`
    - create new path (enter your project path, enable integration tools)
    - select your branch type
    - and finally, enter your branch name

## help

you can enter `dat p` or `dat p [command] -h` for help commands
## redmine integration


#### config
- first of all, you have to check if the REST API is enabled in the admin settings panel. (go to Administration/settings/API)
- then get api key ( from my account/API access key) 
- add api key in `.env` file

#### usage

- used for auto redmine log times on commits
- used for update issue on init branch
- used for update issue status on close branch

## gitlab integration


#### config
- In the top-right corner, select your avatar.
- Select Edit profile.
- On the left sidebar, select Access Tokens.
- Enter a name and optional expiry date for the token.
- Select Create personal access token.
- after that, save your access token on `.env` file

#### usage

- used for auto merge requests on branch close

## Author

developed by madkne, thanks for DAT tool!