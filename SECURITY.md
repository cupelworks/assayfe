# Security policy

## Supported versions

Security fixes go into the latest release on `main`. Older versions don't get backports.

## Reporting a vulnerability

Please don't open a public issue for a security problem.

Report it privately through GitHub instead: on this repository's **Security** tab, choose
**Report a vulnerability**. Only the maintainers can see the report. A vulnerability in the
API itself goes to [the API's Security tab](https://github.com/cupelworks/assay/security) instead.

Include what you can of:

- what the problem is and what an attacker could do with it;
- the steps, or the page and the request, that reproduce it;
- the versions - the front end's, in the page's footer, and the API's, which Settings › Workers
  shows - and how the front end was served: the container image and its tag, or `ng serve`;
  the browser; and whether a sign-in sat in front of it.

You'll get an answer within a week. Once the problem is confirmed, we'll agree on a date to
publish it together with the fix, and credit you unless you'd rather not be named.
