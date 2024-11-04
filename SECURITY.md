# Security Policy

## Reporting a Vulnerability

If you discover a potential security issue in this project, we ask that you notify AWS Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public GitHub issue.

## Supported Versions

This project is an AWS sample providing audio and video segmentation capabilities for Amazon SageMaker Ground Truth. We recommend using the latest version for the most up-to-date security features.

## Security Considerations

This project involves:
- JavaScript and CSS files served through CloudFront
- UI components for SageMaker Ground Truth
- CloudFormation template for deployment

### Key Security Features
- Secure file serving through CloudFront
- Least privilege IAM roles
- No public S3 bucket access
- Input validation and sanitization

## Security Updates

Security updates are delivered through:
1. Direct repository updates
2. Dependency updates (managed through npm)
3. CloudFormation template revisions

## Best Practices
When using this project:
1. Regularly update dependencies
2. Follow AWS security best practices
3. Review CloudFormation permissions before deployment
4. Monitor CloudWatch logs for unusual activity