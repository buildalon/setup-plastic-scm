# Buildalon setup-plastic-scm

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![marketplace](https://img.shields.io/static/v1?label=&labelColor=505050&message=Buildalon%20Actions&color=FF1E6F&logo=github-actions&logoColor=0076D6)](https://github.com/marketplace?query=buildalon) [![actions](https://github.com/buildalon/setup-plastic-scm/actions/workflows/validate.yml/badge.svg?branch=main&event=push)](https://github.com/buildalon/setup-plastic-scm/actions/workflows/validate.yml)

A GitHub action to setup and install [Plastic SCM](https://www.plasticscm.com) (Unity VCS).

## How to use

### workflow

```yaml
steps:
  - uses: buildalon/setup-plastic-scm@v2
  - run: |
      cm version
```

### inputs

| name | description | required |
| ---- | ----------- | -------- |
| `version` | The specific 4 part version to install, for example `11.0.16.9156`. If a different `cm` is already installed, the requested version is installed over it. | defaults to `latest` |

On Windows and macOS the action downloads the Unity VCS cloud edition installer. On Linux it installs from Unity's UVCS apt repository: `latest` installs the `plasticscm-cloud` package, and a pinned `version` pins every Plastic SCM package to that version.

### outputs

- `path`: The full path to the `cm` executable.
- `version`: The installed Plastic SCM version.

### environment variables

- `PLASTIC_SCM_PATH`: The full path to the `cm` executable.

