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
  async ports () {
    return [5432]
  }

  async deploy () {
    const that = this
    const cfgutil = that.node.$env.config.util
    const needDeploy = await super.deploy()

    // console.log(that.name, 'needDeploy=', needDeploy)

    if (!that.isSingle()) {
      throw new Error('集群模式PG部署，尚未实现。')
    }

    // 查找支持全部$webapi服务的节点。需要从$webapi节点访问数据库，据此判定是本地访问还是remote访问。
    const webApiNodes = that.node.$cluster.nodesBySrv('$webapi')
    const fromLocal = (webApiNodes.length === 1 && webApiNodes[0] === that.node)

    if (needDeploy) {
      await that.node.commands.port(fromLocal ? 'close' : 'open', [5432, 5433], Base.nodeIps(webApiNodes))
      // console.log('fromLocal=', fromLocal)
      // console.log('deploy postgresql')
      await that.node.commands.ensurePkg(that.name)
      await that.node.commands.startSrv(that.name)
      // 开始执行psql来配置用户信息。这与发行版无关。
      // console.log('that.node.$env.args.target=', that.node.$env.args.target)
      const passwd = await Base.ensurePwd(cfgutil.path('config', that.node.$env.args.target, 'postgres', 'app.passwd'))
      // console.log('app passwd=', passwd)
      /**
REVOKE ALL PRIVILEGES ON DATABASE app FROM app;
DROP USER IF EXISTS app;
*/
      const sqlContent = `create user app with encrypted password '${passwd}';
GRANT ALL ON SCHEMA public TO app;
create database app;
grant all privileges on database app to app;
ALTER DATABASE app OWNER TO app;
`
      that.node.addAsset('pgapp.sql', sqlContent)
      const cmdStr = `pghome=$(sudo -u postgres -i eval 'echo "$HOME"')
cp -f $INSTROOT/pgapp.sql $pghome/pgapp.sql
sudo chown postgres.postgres $pghome/pgapp.sql
sudo su - postgres -c "psql -f $pghome/pgapp.sql"
rm -f $pghome/pgapp.sql`
      that.node.addStage(that.name, cmdStr)
    }

    // 即使不部署，也需要更新本地local配置，否则可能会丢失配置。
    const localCfg = that.node.$cluster.srvCfg('knex')
    localCfg.conf = localCfg.conf || {}
    localCfg.conf.connection = localCfg.conf.connection || {}
    if (!fromLocal) {
      localCfg.conf.connection.host = that.node.pubIp
    }
  }
}

module.exports = Postgres
