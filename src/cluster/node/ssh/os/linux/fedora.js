/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 13 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: fedora

const debian = require('./debian')

/// 将内部服务映射为issue指定的服务名称。
const srvNameMap = {
  postgres: 'postgresql-15',
  elastic: 'elasticsearch'
}
function getSrvname (srvName) {
  return srvNameMap[srvName] || srvName
}

module.exports.mirror = function (node) {
  const stageName = 'mirror'
  if (!node.hasStage(stageName)) {
    const dateStr = new Date().toJSON().slice(0, 10)
    const cmd = `mirror=$(sudo grep "mirrors.aliyun.com" /etc/yum.repos.d/fedora.repo)
if test -z "$mirror"
then
  sudo mv /etc/yum.repos.d/fedora.repo /etc/yum.repos.d/fedora.repo-${dateStr}.backup
  sudo mv /etc/yum.repos.d/fedora-updates.repo /etc/yum.repos.d/fedora-updates.repo-${dateStr}.backup
  sudo wget -O /etc/yum.repos.d/fedora.repo http://mirrors.aliyun.com/repo/fedora.repo
  sudo wget -O /etc/yum.repos.d/fedora-updates.repo http://mirrors.aliyun.com/repo/fedora-updates.repo
  sudo yum makecache
else
  echo "\\$mirror already setting"
fi
`
    node.addStage(stageName, cmd)
  }
}

module.exports.status = async function (srv, srvnameFunc) {
  return await debian.status(srv, getSrvname)
}

/// ////////////////////////////////////////////////////////////////
// 节点维护函数。
/// ////////////////////////////////////////////////////////////////
function pkgCond (node, pkgName, installCmd, dependencies) {
  const sysctlName = getSrvname(pkgName)
  const cmdStr = `sudo yum list --installed | grep ${sysctlName}
status=$?
if [ $status -ne 0 ]
then
  ${installCmd}
fi
`
  node.addStage(pkgName, cmdStr, dependencies)
}

async function ensurePkg (node, pkgName, pkgVer) {
  const cmdArray = []
  const { s } = node.$env.soa
  const bMirror = node.$env.args.mirror
  const commonName = s.startsWith(pkgName, '$') ? s.strRight(pkgName, '$') : pkgName
  const sysctlName = getSrvname(commonName)
  switch (pkgName) {
    case 'postgres':
      {
        let repoURL
        if (parseInt(node.$info.os.release) >= 35) {
          if (bMirror) {
            repoURL = `https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/F-${node.$info.os.release}-x86_64/pgdg-fedora-repo-latest.noarch.rpm`
          } else {
            repoURL = `https://download.postgresql.org/pub/repos/yum/reporpms/F-${node.$info.os.release}-x86_64/pgdg-fedora-repo-latest.noarch.rpm`
          }
        } else {
          if (bMirror) {
            repoURL = 'https://mirrors.cloud.tencent.com/postgresql/repos/yum/reporpms/EL-9-x86_64/pgdg-fedora-repo-latest.noarch.rpm'
          } else {
            repoURL = 'https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-fedora-repo-latest.noarch.rpm'
          }
        }
        cmdArray.push(`sudo dnf install -y ${repoURL}
sudo wget -O /etc/yum.repos.d/pgdg-fedora-all.repo https://libs.wware.org/pvpipeline/fedora/pgdg-fedora-all.repo
sudo dnf install -y postgresql15-server
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb
sudo systemctl enable postgresql-15
sudo echo "listen_addresses = '*'" >> /var/lib/pgsql/15/data/postgresql.conf
sudo systemctl start postgresql-15
`)
      }
      break
    case 'elastic': // 未支持mirror.
      cmdArray.push(`rpm --import https://artifacts.elastic.co/GPG-KEY-elasticsearch
sudo wget -O /etc/yum.repos.d/elastic.repo https://libs.wware.org/pvpipeline/fedora/elastic.repo
sudo yum install -y --enablerepo=elastic ${sysctlName}
sudo systemctl enable ${sysctlName}
sudo systemctl start ${sysctlName}
`)
      break
    case 'redis':
      cmdArray.push(`sudo yum install -y ${sysctlName}`)
      cmdArray.push(`sudo systemctl enable ${sysctlName}`)
      cmdArray.push(`sudo systemctl start ${sysctlName}`)
      break
    case 'npm':
      throw new Error('not support NPM')
    default:
      cmdArray.push(`sudo yum install -y ${sysctlName}`)
      break
  }
  if (cmdArray.length > 0) {
    pkgCond(node, pkgName, cmdArray.join('\n  '), 'mirror')
  }
}

async function port (node, method, number, fromIps) {
  const { _ } = node.$env.soa
  const zoneName = _.isArray(number) ? `pv-${number[0]}` : `pv-${number}`

  const cmdArray = []

  if (method === 'open') {
    cmdArray.push(`firewall-cmd --get-active-zones | grep ${zoneName}
status=$?
if [ $status -ne 0 ]
then
  sudo firewall-cmd --new-zone=${zoneName} --permanent
fi
`)
    if (_.isArray(fromIps)) {
      for (const ip of fromIps) {
        cmdArray.push(`sudo firewall-cmd --zone=${zoneName} --add-source=${ip} --permanent`)
      }
    } else {
      cmdArray.push(`sudo firewall-cmd --zone=${zoneName} --add-source=${fromIps} --permanent`)
    }

    if (_.isArray(number)) {
      for (const num of number) {
        cmdArray.push(`sudo firewall-cmd --zone=${zoneName} --add-port=${num}/tcp  --permanent`)
      }
    } else {
      cmdArray.push(`sudo firewall-cmd --zone=${zoneName} --add-port=${number}/tcp  --permanent`)
    }
  } else {
    cmdArray.push(`sudo firewall-cmd --delete-zone=${zoneName} --permanent`)
  }
  cmdArray.push('sudo firewall-cmd --reload')
  node.addStage('port', cmdArray.join('\n'))
}

module.exports.ensurePkg = ensurePkg
module.exports.port = port
module.exports.startSrv = async (srv, srvnameFunc) => {
  return debian.startSrv(srv, getSrvname)
}
