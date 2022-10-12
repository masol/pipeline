/**
 * pipeline说明:
 * 编译: build - deploy - test
 * 监测: status
 * 部署: infras(only run if status not ok,except --force given) - deploy
 */

const Names = {
  common: '加载集群定义',
  status: '状态获取',
  deploy: '部署',
  report: '报告',
  finish: '清理'
}

function getEntry (opts) {
  const { task, series } = opts.gulpInst

  task(Names.status, require('./src/status')(opts))
  task(Names.report, require('./src/report')(opts))
  task(Names.common, require('./src/common')(opts))
  task(Names.deploy, require('./src/deploy')(opts))
  task(Names.finish, require('./src/finish')(opts))

  const status = series(Names.common, Names.status, Names.report, Names.finish)
  const deploy = series(Names.common, Names.status, Names.deploy, Names.finish)
  return {
    default: status,
    status,
    deploy
  }
}

module.exports = getEntry
