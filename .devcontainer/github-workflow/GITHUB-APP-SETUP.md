# GitHub App Setup for Automation

## Why Use a GitHub App?

A GitHub App provides:
- ✅ Distinct identity from your personal account
- ✅ Fine-grained permissions 
- ✅ Clear audit trail for automation actions
- ✅ Professional appearance in comments

## Setup Steps

### 1. Create GitHub App

1. Go to https://github.com/settings/apps/new
2. Fill out the form:
   - **App name**: `your-repo-automation` (must be globally unique)
   - **Homepage URL**: Your repository URL
   - **Webhook URL**: Leave blank for now
   - **Permissions**: 
     - Repository permissions:
       - Issues: Read & Write
       - Pull requests: Read & Write  
       - Contents: Read & Write
       - Metadata: Read
   - **Where can this GitHub App be installed?**: Only on this account

3. Click "Create GitHub App"

### 2. Generate Private Key

1. After creation, scroll down to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file

### 3. Install App on Repository

1. Click "Install App" in the left sidebar
2. Select your repository
3. Note the Installation ID from the URL

### 4. Configure Environment

Add to your environment or config:

```bash
# GitHub App credentials
GITHUB_APP_ID=your_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
```

### 5. Update Automation Code

The automation would use GitHub App authentication instead of personal tokens:

```javascript
const { createAppAuth } = require("@octokit/auth-app");

const auth = createAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8'),
  installationId: process.env.GITHUB_APP_INSTALLATION_ID,
});

const octokit = new Octokit({
  auth: await auth({ type: "installation" })
});
```

This way, all automation comments appear from `your-repo-automation[bot]` instead of your personal account.