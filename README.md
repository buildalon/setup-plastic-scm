# setup-plastic-scm

[![Discord](https://img.shields.io/discord/939721153688264824.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2)](https://discord.gg/VM9cWJ9rjH) [![marketplace](https://img.shields.io/static/v1?label=&labelColor=505050&message=Buildalon%20Actions&color=FF1E6F&logo=github-actions&logoColor=0076D6)](https://github.com/marketplace?query=buildalon) [![actions](https://github.com/buildalon/setup-plastic-scm/actions/workflows/validate.yml/badge.svg?branch=main&event=push)](https://github.com/buildalon/setup-plastic-scm/actions/workflows/validate.yml)

A GitHub action to setup and install [Plastic SCM](https://www.plasticscm.com) (Unity VCS).

## How to use

### workflow

```yaml
steps:
  - uses: buildalon/setup-plastic-scm@v1
  - run: |
      cm version
```

### inputs

| name | description | required |
| ---- | ----------- | -------- |
| version | The specific version to install | defaults to the latest |
