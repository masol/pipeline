/**
 * pipeline说明:
 * 编译: build - deploy - test
 * 监测: status
 * 部署: deploy
 */

const os = require('os')
const uniqueFilename = require('unique-filename')
const fs = require('fs').promises
const path = require('path')

const Names = {
  common: '加载集群定义',
  status: '状态获取',
  deploy: '部署',
  report: '报告',
  finish: '清理'
}

function getEntry (opts) {
  const { task, series } = opts.gulpInst

  opts.cacheDir = {
    name: uniqueFilename(os.tmpdir(), 'pvpipeline'),
    created: false,
    ensure: async function (subPath = '') {
      const fullpath = path.join(this.name, subPath)
      return fs.access(fullpath, fs.constants.F_OK)
        .then(() => true)
        .catch(async (e) => {
          return fs.mkdir(fullpath, { recursive: true })
        })
    }
  }

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
