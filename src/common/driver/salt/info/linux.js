/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: linux

/// 获取Linux下的系统信息。
module.exports.info = async function (driver, { node, term, s, getByte }) {
  const $info = node.$info
  const family = await term.exec('cat /proc/cpuinfo | grep \'model name\' | uniq')
  $info.family = s.trim(s.strRight(family, ':'))
  $info.core = await term.exec('cat /proc/cpuinfo | grep processor | wc -l')
  $info.arch = await term.exec('uname -m')
  // 简易分析，未使用dotenv.
  const osInfos = s.lines(await term.exec('cat /etc/os-release'))
  const osVars = {}
  for (const line of osInfos) {
    const varItem = line.split('=')
    if (varItem.length === 2) {
      osVars[s.trim(varItem[0])] = s.trim(varItem[1])
    }
  }
  $info.os.platform = osVars.ID || osVars.NAME || osVars.PRETTY_NAME || 'Linux'
  $info.os.release = s.unquote(osVars.VERSION_ID || osVars.VERSION || osVars.VERSION_CODENAME || 'Linux' || (await term.exec('uname -r')))
  const memInfos = s.lines(await term.exec('cat /proc/meminfo'))
  $info.mem = {}
  for (const line of memInfos) {
    if (s.startsWith(line, 'MemTotal:')) {
      $info.mem.total = getByte(s, line)
    } else if (s.startsWith(line, 'MemFree:')) {
      $info.mem.free = getByte(s, line)
    }
  }
  const netLines = s.lines(await term.exec('ip addr'))
  $info.net = {}
  let currentName = ''
  for (const line of netLines) {
    if (currentName) {
      const regEx = /\s*inet\s*(\d+\.\d+\.\d+.\d+)\/\d+\s+/
      const found = line.match(regEx)
      if (found && found.length >= 2) {
        // console.log('found = ', found)
        if (currentName !== 'lo') {
          $info.net[currentName] = [found[1]]
        }
        currentName = ''
      }
    } else {
      const regEx = /^\d+:\s+(\S+):\s+<[A-Z,_]+>/
      const found = line.match(regEx)
      if (found && found.length >= 2) {
        // console.log('found if name= ', found)
        currentName = found[1]
      }
    }
  }
}

/**
 *  只有不同发行版名称不同的，才需要加入map.例如apache2入口:
 apache2: {
  'centos': 'httpd',
  'fedora': 'httpd'
 }
*/
const srvNameMap = {}
// 获取linux下的服务信息。
module.exports.srv = async function (driver, { srvName, srv, node, term }) {
  const { s } = driver.opts.soa
  const commonName = s.startsWith(srvName, '$') ? s.strRight(srvName, '$') : srvName
  const mapEntry = srvNameMap[commonName]
  const issuer = s.trim(node.$info.os.platform).toLowerCase()
  const usedName = mapEntry && mapEntry[issuer]
    ? mapEntry[issuer]
    : commonName
  const status = await term.exec(`systemctl status ${usedName}`).catch(e => {
    return false
  })
  // console.log(usedName, 'status=', status)
  if (!status) {
    srv.status.ok = false
  } else {
    srv.status.ok = true
  }
}
