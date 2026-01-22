# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it via one of the following methods:

1. **Email**: [Your email address] (preferred)
2. **GitHub Security Advisory**: Use GitHub's [Private Vulnerability Reporting](https://github.com/[your-username]/voltras/security/advisories/new) feature

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

## Security Best Practices

### For Contributors

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Keep dependencies up to date
- Review code changes before submitting PRs

### For Users

- Keep the app updated to the latest version
- Use strong, unique passwords if authentication is implemented
- Report suspicious activity or vulnerabilities immediately

## Security Measures

This project implements the following security measures:

- **Dependency Scanning**: Automated security audits via Dependabot and npm audit
- **Secret Scanning**: GitLeaks scans commits for exposed secrets
- **Code Review**: All changes require review before merging
- **CI/CD Security**: Automated security checks in GitHub Actions

## Acknowledgments

We appreciate responsible disclosure of security vulnerabilities. Contributors who report valid security issues will be credited (with permission) in our security advisories.
