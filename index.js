/**
 * pipeline说明:
 * 编译: build - deploy - test
 * 监测: status
 * 部署: infras(only run if status not ok,except --force given) - deploy
 */

const Names = {
  common: '目标环境准备',
  status: '状态获取',
  report: '报告'
}

function getEntry(opts) {
  const { task, series } = opts.gulpInst

  task(Names.status, require('./src/status')(opts))
  task(Names.report, require('./src/report')(opts))
  task(Names.common, require('./src/common')(opts))

  const status = series(Names.common, Names.status, Names.report)
  return {
    default: status,
    status
  }
}

module.exports = getEntry