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

  opts.tmp = {
    name: uniqueFilename(os.tmpdir(), 'pvpipeline'),
    created: false,
    ensure: async function () {
      const args = [this.name]
      // const { _ } = opts.soa
      for (let i = 0; i < arguments.length; i++) {
        const arg = arguments[i]
        args.push(arg)
        // if (_.isArray(arg)) {
        // }
      }
      const fullpath = path.join.apply(path, args)
      await fs.access(fullpath, fs.constants.F_OK)
        .then(() => true)
        .catch(async (e) => {
          return fs.mkdir(fullpath, { recursive: true })
        })
      return fullpath
    },
    clean: async function () {
      // 清空临时目录。在finish中调用，防止其中保存有secret信息。
      const name = this.name
      await fs.access(name, fs.constants.F_OK)
        .then(() => {
          return fs.rm(name, { recursive: true, force: true })
        })
        .catch((e) => true)
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
