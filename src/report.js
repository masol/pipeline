/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: report

const Table = require('cli-table3')

let chalkInstance = null
async function getChalk () {
  if (!chalkInstance) {
    chalkInstance = (await import('chalk')).default
  }
  return chalkInstance
}

let chalkTemplate = null
async function getTpl () {
  if (!chalkTemplate) {
    chalkTemplate = (await import('chalk-template')).default
  }
  return chalkTemplate
}

let fileSizeInst = null
async function getFSizer () {
  if (!fileSizeInst) {
    fileSizeInst = (await import('filesize')).default
  }
  return fileSizeInst
}

// const chalkAnimation = null
// async function getAnim () {
//   if (!chalkAnimation) {
//     chalkAnimation = (await import('chalk-animation')).default
//   }
//   return chalkAnimation
// }

const logger = require('fancy-log')
// 下两句将使得自定义报告结果与默认gulp保持一致。
const util = require('util')
util.inspect.styles.date = 'gray'

function buildTable (dataArr, opts, defPlaceHolder) {
  const { _ } = opts.soa
  let idx = 0
  const header = {}
  for (const item of dataArr) {
    const itemH = _.keys(item)
    for (const h of itemH) {
      if (typeof header[h] === 'undefined') {
        header[h] = idx
        idx++
      }
    }
  }
  const tableParam = {
    head: new Array(_.keys(header).length).fill(defPlaceHolder),
    wordWrap: true
  }
  for (const item in header) {
    tableParam.head[header[item]] = item
  }
  const retTable = new Table(tableParam)
  for (const item of dataArr) {
    const newItem = new Array(tableParam.head.length).fill(defPlaceHolder)
    for (let i = 0; i < tableParam.head.length; i++) {
      const hName = tableParam.head[i]
      if (typeof item[hName] !== 'undefined') {
        newItem[i] = String(item[hName])
      }
    }
    retTable.push(newItem)
  }
  // console.log(retTable)
  return retTable
}

module.exports = function (opts) {
  return async function () {
    const chalk = await getChalk()

    const defPlaceHolder = chalk.gray('-')

    const fsizer = await getFSizer()
    const sizer = fsizer.partial({ base: 2, standard: 'jedec' })
    const tpl = await getTpl()
    const { _ } = opts.soa

    logger(tpl`{green ======目标集群{red.bold ${opts.args.target}}共包含{red.bold ${_.keys(opts.deployer.nodes).length}}个节点:{yellow.bold 状态报告}=====}`)

    let canDeploy = false
    // 开始构建table数据。
    const baseReporter = new Table({
      head: ['节点名称',
        'cpu型号',
        '架构',
        '线程',
        '操作系统',
        '版本号',
        '总内存',
        '可用内存',
        '网络'
      ],
      colWidths: [12, 21, 6, 6, 10, 19, 12, 12, 6],
      wordWrap: true
    })
    const netReporter = []
    const srvReporter = []
    for (const name in opts.deployer.nodes) {
      const node = opts.deployer.nodes[name]
      const $info = node.$info
      if (node.type === 'oss') {
        baseReporter.push([
          name,
          defPlaceHolder,
          defPlaceHolder,
          defPlaceHolder,
          'OSS',
          defPlaceHolder,
          defPlaceHolder,
          defPlaceHolder,
          _.keys($info.net).length
        ])
        let i = 0
        const net = {
          节点名称: name
        }
        for (const ifname in $info.net) {
          net[`网卡${i}`] = ifname
          net[`网卡${i}地址`] = $info.net[ifname]
          i++
        }
        netReporter.push(net)
      } else {
        const family = $info.cpus.length > 0 ? $info.cpus[0].model : '未知'
        baseReporter.push([
          name,
          family,
          $info.arch,
          $info.cpus.length,
          $info.os.platform,
          $info.os.release,
          sizer($info.mem.total),
          sizer($info.mem.free),
          _.keys($info.net).length
        ])
        const net = {
          节点名称: name
        }
        const srv = {
          节点名称: name
        }

        let i = 0
        for (const ifname in $info.net) {
          net[`网卡${i}`] = ifname
          net[`网卡${i}地址`] = $info.net[ifname]
          i++
        }
        for (const srvName in node.srvs) {
          const srvInfo = node.srvs[srvName].status || {}
          // console.log('srvInfo=', srvInfo)
          srv[srvName] = srvInfo.ok ? chalk.green(srvInfo.ok) : chalk.red(srvInfo.ok)
          if (!srvInfo.ok) {
            canDeploy = true
          }
        }
        netReporter.push(net)
        srvReporter.push(srv)
      }
    }

    logger(tpl`{green ~~~{yellow.bold 节点基础信息}~~~}`)
    console.log(baseReporter.toString())

    logger(tpl`{green ~~~{yellow.bold 节点网络信息}~~~}`)
    console.log(buildTable(netReporter, opts, defPlaceHolder).toString())

    logger(tpl`{green ~~~{yellow.bold 节点服务信息}~~~}`)
    console.log(buildTable(srvReporter, opts, defPlaceHolder).toString())
    if (canDeploy) {
      logger(tpl`{red 有节点服务未就绪,需要执行{gray gulp deploy}来部署。}`)
    } else {
      logger(tpl`{green 环境就绪!}`)
    }
  }
}
