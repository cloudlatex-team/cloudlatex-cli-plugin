# Cloud LaTeX CLI
*** Write locally and compile on cloud service.

Cloud LaTeX CLI is an official tool written in nodejs to write tex files locally and compile with [Cloud LaTeX](https://cloudlatex.io/).

You can write tex files with your favorite editor and compile them without installing very large latex compiler!

If you use VSCode, you can use [Cloud LaTeX VSCode Extension](https://github.com/cloudlatex-team/cloudlatex-vscode-extension).

## Features
- Multi-platform
- Offline mode


## Installation
```
npm install -g cloudlatex-cli
```

## Account Settings
If you have no Cloud LaTeX account, you need to create your account from [here](https://cloudlatex.io/).

Create your project which you want to edit locally on the [web page](https://cloudlatex.io/projects). 

Generate client id and token from [Account name] -> [Extension] at the [project page](https://cloudlatex.io/projects) and record them.


## Usage
On your latex directory, run the following command.

＊ For the first time, the directory should be empty, otherwise local files on the directory will be overwritten.
```
cloudlatex-cli --path ./  \
  --outdir ./workspace \
  --project [Your ProjectId] \
  --email [Your email address used for CloudLaTeX account] \
  --client [Your client id] \
  --token [Your token] 
```


Then, your project files will be downloaded.
Local file changes will synchronized with the Cloud LaTeX server and compilation is fired on the server.

After the second time, run the same command as before.

＊ File changes when this tool is not running are not synchronized.

# License
Apache License 2.0
