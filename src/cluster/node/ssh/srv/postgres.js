/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 14 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: postgres

// const path = require('path')
// const fs = require('fs').promises
// const yaml = require('js-yaml')
// const srvUtil = require('./utils')
// const globSrv = require('../../../srv')

// module.exports.deploy = async (node, { localBase, stateTop, pillarTop, srvName, srv, postTasks }) => {
//   const info = {
//     name: srvName,
//     mirror: 'https://libs.wware.org/stacksalt/formula/postgres/',
//     ver: 'v0.45.0',
//     url: 'https://github.com/saltstack-formulas/postgres-formula/archive/refs/tags/',
//     idFile: 'FORMULA', // 确定formula根目录的文件。
//     subDir: 'postgres', // 在formula zip根目录确定后，真正State的子目录，如果是空，则根目录即为State定义目录。
//     // ver: 'master',
//     // url: 'https://github.com/salt-formulas/salt-formula-postgresql/archive/refs/heads/',
//     // idFile: 'VERSION',
//     // subDir: 'postgresql',
//     localBase
//   }

//   await srvUtil.ensureStateRes(node, info)

//   const cfgutil = node.$env.config.util
//   const appPwdFile = cfgutil.path('config', node.$env.args.target, srvName, 'app.passwd')
//   const aapPasswd = await srvUtil.ensurePasswd(appPwdFile, node.$env)
//   const { _ } = node.$env.soa

//   const pillar = _.merge({
//     'postgres.port': '5432',
//     postgres: {
//       use_upstream_repo: 'True',
//       version: 14.5,
//       add_profile: false,
//       fromrepo: 'jessie-pgdg',
//       pkgs_extra: ['postgresql-contrib', 'postgresql-plpython'],
//       linux: {
//         altpriority: 30
//       },
//       limits: {
//         soft: 64000,
//         hard: 128000
//       },
//       'pg_hba.conf': 'salt://postgres/templates/pg_hba.conf.j2',
//       bake_image: false,
//       users: {
//         app: {
//           ensure: 'present',
//           password: aapPasswd,
//           createdb: false,
//           createroles: false,
//           inherit: true,
//           replication: false
//         }
//       },
//       databases: {
//         app: {
//           owner: 'app',
//           template: 'template0',
//           lc_ctype: 'zh_CN.UTF-8',
//           lc_collate: 'zh_CN.UTF-8'
//         }
//       }
//     }
//   }, srv.srvDef.pillar)
//   // 防止pillar中定义了password,如果有，这里覆盖之。
//   pillar.postgres.users.app.password = aapPasswd
//   // console.log('aapPasswd=', aapPasswd)

//   const srvCluster = new srvUtil.SrvCluster(srv)
//   if (srvCluster.isSingle()) {
//     console.log('配置单机模式pg')
//   } else {
//     const repPwdFile = cfgutil.path('config', node.$env.args.target, srvName, 'rep.passwd')
//     const repPasswd = await srvUtil.ensurePasswd(repPwdFile, node.$env)
//     pillar.postgres.users.repuser = {
//       ensure: 'present',
//       password: repPasswd,
//       createdb: true,
//       createroles: true,
//       inherit: true,
//       replication: true
//     }
//     pillar.postgres.postgresconf = ["    listen_addresses = '*'  # listen on all interfaces"]
//     pillar.postgres.cluster = _.merge({
//       locale: 'zh_CN.UTF-8'
//     }, pillar.postgres.cluster)

//     if (srvCluster.isMulMaster()) {
//       console.log('配置多master模式pg')
//       // console.log('ips=', srvCluster.masterIps())
//     } else { // master-slave模式。
//       console.log('配置master-slave模式pg')
//     }
//   }

//   console.log('pillar=', pillar)

//   const pillarPath = path.join(localBase, srv.node.$name, 'pillar', `${srvName}.sls`)
//   await fs.writeFile(pillarPath, yaml.dump(pillar, { sortKeys: false }))
//   // console.log('pillarPath=', pillarPath)

//   postTasks.push(() => {
//     globSrv.callOnceTask('pg-post', srv, async (taskName, srv) => {
//       console.log('enter pg-post implement:')
//       // 这里执行pg安装完毕之后的任务。
//       // 表格初始化及admin用户初始化，属于$webapi的工作。在其首次部署时执行。
//       // 表格migrate的工作属于$webapi的工作。$webapi发生部署时执行一次。
//     })
//   })

//   srvUtil.addSrv(stateTop, srvName)
//   srvUtil.addSrv(pillarTop, srvName)
// }
