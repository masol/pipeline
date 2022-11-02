/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 13 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: debian

// debian镜像使用腾讯云,支持http协议，无需执行 apt-get install apt-transport-https
module.exports.mirror = function (node) {
  const stageName = 'mirror'
  if (!node.hasStage(stageName)) {
    const cmd = `mirror=$(sudo grep "mirrors.cloud.tencent.com" /etc/apt/sources.list)
if test -z "$mirror"
then
  sudo sed -i 's#http://deb.debian.org#http://mirrors.cloud.tencent.com#g' /etc/apt/sources.list
  sudo apt-get -y update
  sudo apt-get -y upgrade
else
  echo "\\$mirror already setting"
fi
  `
    node.addStage(stageName, cmd)
  }
}

/// 将标准服务映射为issue指定的服务名称。
const srvNameMap = {
  postgres: 'postgresql',
  redis: 'redis-server',
  elastic: 'elasticsearch'
}
function getSrvname (srvName) {
  return srvNameMap[srvName] || srvName
}

module.exports.status = async function (srv, srvnameFunc) {
  const { s, _ } = srv.node.$env.soa
  const srvName = srv.name
  const term = srv.node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  srvnameFunc = srvnameFunc || getSrvname
  const sysctlName = srvnameFunc(commonName)

  let status
  const statusRes = await term.exec(`systemctl status ${sysctlName}`).catch(e => {
    return false
  })
  // console.log('statusRes=', statusRes)
  if (_.isString(statusRes) && /Active: active/.test(statusRes)) {
    status = true
  } else {
    status = false
  }
  if (!status) {
    srv.status.ok = false
  } else {
    srv.status.ok = true
  }
}

async function startSrv (srv, srvnameFunc) {
  const { s } = srv.node.$env.soa
  const srvName = srv.name
  // const term = srv.node.$term
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  srvnameFunc = srvnameFunc || getSrvname
  const sysctlName = srvnameFunc(commonName)
  srv.node.addStage(srv.name, `sudo systemctl restart ${sysctlName}`)
  // await term.exec(`sudo systemctl restart ${sysctlName} 2>&1 | tee -a ${srv.node.logfname}`)
}

function pkgCond (node, pkgName, installCmd, dependencies) {
  const sysctlName = getSrvname(pkgName)
  const cmdStr = `dpkg -s ${sysctlName}
status=$?
if [ $status -ne 0 ]
then
  ${installCmd}
fi
`
  node.addStage(pkgName, cmdStr, dependencies)
}

// 为指定节点，安装software规定的软件。
async function ensurePkg (node, pkgName, pkgVer) {
  const cmdArray = []
  const { s } = node.$env.soa
  const bMirror = node.$env.args.mirror
  const commonName = s.startsWith(pkgName, '$') ? s.strRight(pkgName, '$') : pkgName
  const sysctlName = getSrvname(commonName)

  switch (pkgName) {
    case 'postgres':
      if (bMirror) {
        cmdArray.push('sudo sh -c \'echo "deb https://mirrors.cloud.tencent.com/postgresql/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list\'')
        cmdArray.push('sudo wget --quiet -O - https://mirrors.cloud.tencent.com/postgresql/repos/apt/ACCC4CF8.asc | sudo apt-key add -')
      } else {
        cmdArray.push('sudo sh -c \'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list\'')
        cmdArray.push('sudo wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -')
      }
      cmdArray.push('sudo apt-get -y install apt-transport-https ca-certificates')
      cmdArray.push('sudo apt-get -y update')
      cmdArray.push(`sudo apt-get -y install ${sysctlName}`)
      cmdArray.push(`PGCFGFILE=''
if test -f "/etc/postgresql/15/main/postgresql.conf"; then
  PGCFGFILE=/etc/postgresql/15/main/postgresql.conf
elif test -f "/etc/postgresql/14/main/postgresql.conf"; then
  PGCFGFILE=/etc/postgresql/14/main/postgresql.conf
fi
[ -z "$PGCFGFILE" ] || sudo echo "listen_addresses = '*'" >> $PGCFGFILE
`)
      {
        const webApiNodes = node.$cluster.nodesBySrv('$webapi')
        const fromLocal = (webApiNodes.length === 1 && webApiNodes[0] === node)
        if (!fromLocal) {
          cmdArray.push(`PGHBAILE=''
          if test -f "/etc/postgresql/15/main/pg_hba.conf"; then
            PGHBAILE=/etc/postgresql/15/main/pg_hba.conf
          elif test -f "/etc/postgresql/14/main/pg_hba.conf"; then
            PGHBAILE=/etc/postgresql/14/main/pg_hba.conf
          fi
          `)
          for (const n of webApiNodes) {
            if (n !== node) {
              cmdArray.push(`[ -z "$PGHBAILE" ] || sudo echo "host    all             all             ${n.pubIp}/32       md5" >> $PGHBAILE`)
            }
          }
        }
      }
      cmdArray.push(`sudo systemctl restart ${sysctlName}`)
      break
    case 'elastic':
      cmdArray.push(`sudo apt-get -y install apt-transport-https ca-certificates
sudo wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
sudo echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update
sudo apt-get -y install elasticsearch expect
sudo systemctl daemon-reload
sudo systemctl enable elasticsearch.service
sudo systemctl start elasticsearch.service
sudo expect $INSTROOT/elastic.exp > $INSTROOT/elastic.passwd
`)
      // sudo cp /etc/elasticsearch/certs/http_ca.crt $INSTROOT/http_ca.crt
      node.addAsset('elastic.exp', `#!/usr/bin/expect -f
set timeout -1
spawn /usr/share/elasticsearch/bin/elasticsearch-reset-password -u elastic -f -s
match_max 100000
expect -exact "Please confirm that you would like to continue \\[y/N\\]"
send -- "y\r"
expect eof`)
      break
    case 'redis':
      cmdArray.push(`sudo apt-get -y install ${sysctlName}`)
      cmdArray.push('sudo sed -i \'s#^bind 127.0.0.1#bind 0.0.0.0#g\' /etc/redis/redis.conf')
      cmdArray.push(`sudo systemctl start ${sysctlName}`)
      break
    case 'npm':
      throw new Error('not support NPM')
    // case 'npm':
    //   cmdArray.push(`sudo apt-get -y install ${sysctlName}`)
    //   cmdArray.push('sudo npm install -g npm')
    //   if (bMirror) {
    //     cmdArray.push('sudo npm config set registry=https://registry.npmmirror.com')
    //   }
    //   break
    default:
      cmdArray.push(`sudo apt-get -y install ${sysctlName}`)
      break
  }
  if (cmdArray.length > 0) {
    pkgCond(node, pkgName, cmdArray.join('\n  '), 'mirror')
  }
  // console.log(`${pkgName} info=`, info)
}

async function port (node, method, number, fromIps) {
// 首先确保ufw安装完毕。
  const term = node.$term
  const hasUfw = await term.exec('which ufw').catch(e => '')
  if (!hasUfw) {
    await term.exec(`sudo apt-get -y install ufw 2>&1 | tee -a ${node.logfname}`)
    await term.exec('sudo ufw allow OpenSSH')
    await term.exec('sudo ufw default allow outgoing')
    await term.exec('sudo ufw default deny incoming')
    await term.pvexec('sudo ufw enable\ny', {
      out: [{
        method: 'wait',
        exp: 'Proceed with operation (y|n)',
        action: (socket) => {
          console.log('found proceed with operation!!')
          return socket.stdin.write('exit\n')
        }
      }]
    })
  }
  const portMethod = (method === 'open') ? 'allow' : 'deny'
  const { _ } = node.$env.soa
  const cmdArray = []
  const handleNum = async (portNumber) => {
    if (method === 'open' && fromIps) { // 只对fromIps的ip开放访问权限。
      if (_.isArray(fromIps)) {
        for (const ip of fromIps) {
          cmdArray.push(`sudo ufw allow from ${ip} to any port ${portNumber}`)
        }
        // await term.exec(`sudo ufw deny ${portNumber}`)
      } else {
        cmdArray.push(`sudo ufw allow from ${fromIps} to any port ${portNumber}`)
        // await term.exec(`sudo ufw deny ${portNumber}`)
      }
    } else {
      cmdArray.push(`sudo ufw ${portMethod} ${portNumber}`)
    }
  }

  if (_.isArray(number)) {
    for (const num of number) {
      await handleNum(num)
    }
  } else {
    await handleNum(number)
  }
  cmdArray.push('sudo ufw reload')
  node.addStage('port', cmdArray.join('\n'))
}

module.exports.ensurePkg = ensurePkg
module.exports.port = port
module.exports.startSrv = startSrv
