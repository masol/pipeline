/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 19 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: postgres
const Base = require('./base')

class Postgres extends Base {
  async deploy () {
    const that = this
    const cfgutil = that.node.$env.config.util
    await super.deploy()
    if (!that.isSingle()) {
      throw new Error('集群模式PG部署，尚未实现。')
    }

    // 查找支持全部$webapi服务的节点。需要从$webapi节点访问数据库，据此判定是本地访问还是remote访问。
    const webApiNodes = that.node.$cluster.nodesBySrv('$webapi')
    const fromLocal = (webApiNodes.length === 1 && webApiNodes[0] === that.node)
    await that.node.port(fromLocal ? 'close' : 'open', [5432, 5433])
    // console.log('fromLocal=', fromLocal)
    console.log('deploy postgresql')
    await that.node.ensurePkg(that.name)
    // 开始执行psql来配置用户信息。这与发行版无关。
    // console.log('that.node.$env.args.target=', that.node.$env.args.target)
    const passwd = await Base.ensurePwd(cfgutil.path('config', that.node.$env.args.target, 'postgres', 'app.passwd'))
    console.log('app passwd=', passwd)
    const term = that.node.$term
    await term.pvexec('sudo su - postgres', {
      err: (err) => {
        // 先忽略错误。
        console.log('err occupy:', err)
      },
      out: [{
        mode: 'wait',
        exp: 'postgres@',
        test: 1,
        action: (socket) => {
          return socket.stdin.write('createdb app\n')
        }
      }, {
        mode: 'wait',
        exp: 'postgres@',
        test: 2,
        action: (socket) => {
          return socket.stdin.write('createuser app -P\n')
        }
      }, {
        mode: 'wait',
        exp: 'Enter password for new role',
        test: 3,
        action: (socket) => {
          return socket.stdin.write(`${passwd}\n`)
        }
      }, {
        mode: 'expect',
        exp: 'Enter it again',
        test: 4,
        action: (socket) => {
          return socket.stdin.write(`${passwd}\n`)
        }
      }, {
        mode: 'wait',
        exp: 'postgres@',
        test: 6,
        action: (socket) => {
          return socket.stdin.write('psql -c "GRANT ALL PRIVILEGES ON DATABASE app TO app;"\n')
        }
      }, {
        mode: 'wait',
        exp: 'postgres@',
        test: 7,
        action: (socket) => {
          return socket.stdin.write('exit\nexit\n')
        }
      }],
      opts: {
        autoExit: false,
        debug: true
      }
    })
  }
}

module.exports = Postgres
