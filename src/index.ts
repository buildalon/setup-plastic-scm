import core = require('@actions/core');
import exec = require('@actions/exec');
import glob = require('@actions/glob');
import tc = require('@actions/tool-cache');
import path = require('path');
import fs = require('fs');

const main = async () => {
    try {
        run();
    } catch (error) {
        core.setFailed(error);
    }
}

main();

async function run(): Promise<void> {
    try {
        await exec.exec('cm', ['version']);
    } catch (error) {
        await install();
        try {
            await exec.exec('cm', ['version']);
        } catch (error) {
            core.error(`Failed to call cm command!\n${error}`);
        }
    }
    try {
        await testConnection();
    } catch (error) {
        await configure();
    }
}

function getTempDirectory(): string {
    return process.env['RUNNER_TEMP'] || '';
}

async function install() {
    let version = core.getInput('version');
    if (version === 'latest') {
        version = undefined;
    }
    switch (process.platform) {
        case 'win32': return await installWindows(version);
        case 'darwin': return await installMac(version);
        case 'linux': return await installLinux(version);
    }
}

async function getDownloadUrl(version: string): Promise<[string, string]> {
    switch (process.platform) {
        case 'win32': return [`https://www.plasticscm.com/download/downloadinstaller/${version}/plasticscm/windows/cloudedition`, `unity-vcs-${version}-win.exe`];
        case 'darwin': return [`https://www.plasticscm.com/download/downloadinstaller/${version}/plasticscm/macosx/cloudedition`, `unity-vcs-${version}-mac.pkg.zip`];
        default: throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

async function getToolLatestVersion(): Promise<string> {
    let output: string = '';
    await exec.exec('curl', ['-s', 'https://www.plasticscm.com/api/lastversion/after/9.0.0.0/for/cloud/windows'], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        },
        silent: !core.isDebug()
    });
    const json = JSON.parse(output);
    const version = json.version;
    if (!version) {
        throw new Error('Failed to get the latest version');
    }
    return version;
}

async function installWindows(version: string) {
    if (!version) {
        version = await getToolLatestVersion();
    }
    const [url, archiveName] = await getDownloadUrl(version);
    core.debug(`Downloading ${archiveName} from ${url}...`);
    const installerPath = path.join(getTempDirectory(), archiveName);
    const downloadPath = await tc.downloadTool(url, installerPath);
    await exec.exec(`cmd`, ['/c', downloadPath, '--mode', 'unattended', '--unattendedmodeui', 'none', '--disable-components', 'ideintegrations,eclipse,mylyn,intellij12']);
    await fs.promises.unlink(downloadPath);
    core.addPath('C:\\Program Files\\PlasticSCM5\\client');
}

async function installMac(version: string) {
    if (!version) {
        version = await getToolLatestVersion();
    }
    const [url, archiveName] = await getDownloadUrl(version);
    core.debug(`Downloading ${archiveName} from ${url}...`);
    const installerPath = path.join(getTempDirectory(), archiveName);
    const downloadPath = await tc.downloadTool(url, installerPath);
    const expandedPath = await tc.extractZip(downloadPath);
    const globber = await glob.create(path.join(expandedPath, '*.pkg'));
    const pkgPaths: string[] = await globber.glob();
    if (!pkgPaths || pkgPaths.length === 0) {
        throw new Error('Failed to find the installer package');
    }
    await exec.exec('sudo', ['installer', '-pkg', pkgPaths[0], '-target', '/Applications']);
    await fs.promises.unlink(downloadPath);
}

async function installLinux(version: string) {
    let installArg = 'plasticscm-cloud';
    if (version) {
        installArg += `=${version}`;
    }
    await exec.exec('sudo', ['apt-get', 'update']);
    await exec.exec('sudo', ['apt-get', 'install', '-y', 'apt-transport-https']);
    await exec.exec('sudo', ['sh', '-c', `echo "deb https://www.plasticscm.com/plasticrepo/stable/debian/ ./" | sudo tee /etc/apt/sources.list.d/plasticscm-stable.list`]);
    await exec.exec('sudo', ['wget', 'https://www.plasticscm.com/plasticrepo/stable/debian/Release.key', '-O', 'Release.key']);
    await exec.exec('sudo', ['apt-key', 'add', 'Release.key']);
    await exec.exec('sudo', ['apt-get', 'update']);
    await exec.exec('sudo', ['apt-get', 'install', installArg]);
}

async function testConnection() {
    const expect = `Test connection executed successfully`;
    let output: string = '';
    await exec.exec('cm', ['checkconnection'], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        }
    });
    if (!output.includes(expect)) {
        throw new Error(`Test connection failed!\n${output}`);
    }
}

async function configure() {
    core.info('Configuring Plastic SCM...');
    const projectId = core.getInput('unity-cloud-project-id', { required: true });
    const credentials = core.getInput('unity-service-account-credentials', { required: true });
    const accessToken = await getUnityAccessToken(projectId, credentials);
    const [username, token] = await exchangeToken(accessToken);
    let organization = core.getInput('uvcs-organization', { required: false });
    if (!organization) {
        organization = await getOrganization(username, token);
    }
    await exec.exec('cm', [`configure`, `--workingmode=SSOWorkingMode`, `--server=${organization}@cloud`, `--user=${username}`, `--token=${token}`]);
    await exec.exec('cm', ['checkconnection']);
}

async function exchangeToken(accessToken: string): Promise<[string, string]> {
    core.info('Exchanging token...');
    let output: string = '';
    await exec.exec('curl', ['-X', 'GET', '-H', `https://www.plasticscm.com/api/oauth/unityid/exchange/${accessToken}`], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        },
        silent: true
    });
    const json = JSON.parse(output);
    const token = json.accessToken;
    core.setSecret(token);
    const username = json.user;
    core.setSecret(username);
    return [username, token];
}

async function getOrganization(username: string, token: string): Promise<string> {
    core.info('Getting the organization...');
    const credentialsBase64 = Buffer.from(`${username}:${token}`).toString('base64');
    core.setSecret(credentialsBase64);
    let output: string = '';
    await exec.exec('curl', ['-X', 'GET', '-H', `Authorization: Basic ${credentialsBase64}`, 'https://www.plasticscm.com/api/cloud/organizations'], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        }
    });
    const json = JSON.parse(output);
    const organizations = json.organizations;
    if (!organizations || organizations.length === 0) {
        throw new Error(`Failed to get the organizations\n${output}`);
    }
    return organizations[0];
}

async function getUnityAccessToken(projectId: string, credentials: string): Promise<string> {
    core.info('Getting Unity access token...');
    const credentialsBase64 = Buffer.from(credentials).toString('base64');
    core.setSecret(credentialsBase64);
    let output: string = '';
    const payload = { "scopes": [] };
    await exec.exec('curl', ['-X', 'POST', '-H', `Authorization: Basic ${credentialsBase64}`, '-H', 'Content-Type: application/json', '-d', JSON.stringify(payload), `https://services.api.unity.com/auth/v1/token-exchange?projectId=${projectId}`], {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        },
        silent: true
    });
    let json: any;
    try {
        json = JSON.parse(output);
    } catch (error) {
        throw new Error(`Failed to get the access token!\n${output}`);
    }
    const error = json.error;
    if (error) {
        throw new Error(`Failed to get the access token!\n${error}`);
    }
    const accessToken = json.accessToken;
    if (!accessToken) {
        throw new Error(`Failed to get the access token!\n${output}`);
    }
    core.setSecret(accessToken);
    return accessToken;
}
