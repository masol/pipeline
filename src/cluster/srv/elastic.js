/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 22 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: elastic
const Base = require('./base')
const fse = require('fs-extra')

class Elastic extends Base {
  async deploy () {
    const that = this
    const needDeploy = await super.deploy()
    console.log(that.name, 'needDeploy=', needDeploy)

    if (!that.isSingle()) {
      throw new Error('集群模式Elastic部署，尚未实现。')
    }

    // 查找支持全部$webapi服务的节点。需要从$webapi节点访问数据库，据此判定是本地访问还是remote访问。
    const webApiNodes = that.node.$cluster.nodesBySrv('$webapi')
    const fromLocal = (webApiNodes.length === 1 && webApiNodes[0] === that.node)

    if (needDeploy) {
      await that.node.commands.port(fromLocal ? 'close' : 'open', 6379, Base.nodeIps(webApiNodes))

      await that.node.commands.ensurePkg(that.name)
      that.node.commands.startSrv(that.name)
      // 添加cluster的beforeApp任务，将节点的password及crt拷贝回来。
      that.node.$cluster.tasks.push({
        beforeApp: true,
        handler: async (stage) => {
          const term = that.node.$term
          const { s } = that.node.$env.soa
          const $env = that.node.$env
          const cfgutil = $env.config.util

          // console.log('before app: elastic:', `${that.node.instRoot}/elastic.passwd`)
          const passwdLines = s.lines(await term.exec(`sudo cat ${that.node.instRoot}/elastic.passwd`).catch(e => ''))
          for (let idx = 0; idx < passwdLines.length; idx++) {
            const line = s.trim(passwdLines[idx])
            // console.log('line=', line)
            if (s.startsWith(line, 'Please confirm that you would like to continue')) {
              const passwd = s.trim(passwdLines[idx + 1])
              const espassFile = cfgutil.path('config', $env.args.target, 'elastic', 'passwd')
              await fse.outputFile(espassFile, passwd)
              // console.log('final password=', passwd)
              break
            }
          }
          // console.log('readed passwd=', passwdLines)
          const sftp = await term.pvftp()
          const localCrt = cfgutil.path('config', $env.args.target, 'elastic', 'http_ca.crt')
          await fse.ensureFile(localCrt)
          await sftp.fastGet('/etc/elasticsearch/certs/http_ca.crt', localCrt).catch(e => '')
        }
      })
    }
    // 即使不部署，也需要更新本地local配置，否则会丢失配置。
    const localCfg = that.node.$cluster.srvCfg('elastic')
    localCfg.conf = localCfg.conf || {}
    if (!fromLocal) {
      localCfg.conf.host = that.node.pubIp
    }
  }
}

module.exports = Elastic
