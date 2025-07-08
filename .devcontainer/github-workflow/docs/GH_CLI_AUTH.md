# Authenticating GitHub CLI with Bot Token

## Method 1: Using GH_TOKEN Environment Variable

The GitHub CLI automatically uses the `GH_TOKEN` environment variable if set:

```bash
# Export your bot token as GH_TOKEN
export GH_TOKEN=$GITHUB_BOT_TOKEN

# Now gh commands will use this token automatically
gh issue list
gh workflow list
```

## Method 2: Using --with-token Flag

Pass the token directly to gh auth login:

```bash
# Authenticate using the token from environment variable
echo $GITHUB_BOT_TOKEN | gh auth login --with-token

# Verify authentication
gh auth status
```

## Method 3: One-liner for Scripts

For use in scripts or CI/CD:

```bash
# Set token for single command
GH_TOKEN=$GITHUB_BOT_TOKEN gh issue create --title "Test" --body "Test issue"

# Or export for session
export GH_TOKEN=$GITHUB_BOT_TOKEN
```

## Method 4: In GitHub Actions Workflows

In your workflow files:

```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_BOT_TOKEN }}

steps:
  - name: Create issue
    run: |
      gh issue create \
        --title "Automated Issue" \
        --body "Created by workflow"
```

## Verify Authentication

Check that authentication is working:

```bash
# Check auth status
gh auth status

# Test with a simple command
gh api user
```

## Security Notes

1. **Never commit tokens**: Always use environment variables or secrets
2. **Use fine-grained PATs**: Limit permissions to what's needed
3. **Rotate regularly**: Update tokens periodically
4. **Secure storage**: Store tokens in secure secret managers

## Troubleshooting

If authentication fails:

1. Check token permissions match what's needed
2. Ensure token hasn't expired
3. Verify you're in the correct repository
4. Try re-authenticating with `gh auth logout` then login again