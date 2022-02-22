addEventListener("fetch",(event)=>{
	event.respondWith(
		handleRequest(event.request).catch(
			(err)=>new Response(err.stack,{status:500})
		)
	);
});
function wrapExternalLink(base,href){
	return'<a href="'+href+'" target="_blank">'+base+'</a>';
}
function genTabName(pkg){
	let ret=pkg.name;
	const nameHrefList=[
		[(pkg)=>{return pkg.felix=='legacy';},(pkg)=>{
			return'https://archriscv.felixc.at/.status/logs/'+pkg.name+'.log';
		}],
		[(pkg)=>{return pkg.felix=='dir';},(pkg)=>{
			return'https://archriscv.felixc.at/.status/logs/'+pkg.name+'/';
		}],
		[(pkg)=>{return pkg.rotten==true;},(pkg)=>{
			return'https://github.com/felixonmars/archriscv-packages/tree/master/'+pkg.name+'/';
		}]
	];
	for(const nameHref of nameHrefList)
		if(nameHref[0](pkg)){
			ret=wrapExternalLink(ret,nameHref[1](pkg));
			break;
		}
	if(pkg.work.typ=='prrm')
		ret='<del>'+ret+'</del>';
	const pkgtagList=[
		[(pkg)=>{return pkg.felix=='legacy'},'legacy'],
		[(pkg)=>{return pkg.felix=='leaf'},'leaf'],
		[(pkg)=>{return pkg.rotten==true},'rotten']
	];
	for(const pkgtag of pkgtagList)
		if(pkgtag[0](pkg))
			ret+=' <span class="pkgtag pkgtag-'+pkgtag[1]+'">['+pkgtag[1]+']</span>';
	return ret;
}
function genTabUser(pkg){
	return pkg.user;
}
function genTabWork(pkg){
	const workTyp2Str={
		'add':'working',
		'pr':'pull requested',
		'prrm':'rm requested',
		'merged':'merged',
		'':''
	};
	let ret=workTyp2Str[pkg.work.typ];
	const workHrefList=[
		[(pkg)=>{return pkg.work.typ=='pr'||pkg.work.typ=='prrm';},(pkg)=>{
			return pkg.work.prurl;
		}],
		[(pkg)=>{return pkg.work.typ=='merged';},(pkg)=>{
			return'https://github.com/felixonmars/archriscv-packages/tree/master/'+pkg.name+'/';
		}]
	];
	for(const workHref of workHrefList)
		if(workHref[0](pkg)){
			ret=wrapExternalLink(ret,workHref[1](pkg));
			break;
		}
	return ret;
}
function genTabMark(pkg){
	const markTyp2Str={
		'unknown':"unknown",
		'upstreamed':"upstreamed",
		'outdated':"outdated",
		'outdated_dep':"dep outdated",
		'stuck':"stuck",
		'noqemu':"noqemu",
		'ready':"ready",
		'pending':"pending",
		'ignore':"ignore",
		'missing_dep':"dep missing",
		'':''
	};
	return pkg.mark.map((mark)=>{
		let ret=markTyp2Str[mark.typ];
		let link=mark.msg.comment.match(/http[s]?:\/\/[^ ]*/g);
		if(link!=null)
			ret=wrapExternalLink(ret,link[0]);
		let title='marked-by:'+mark.msg.by;
		if(mark.msg.comment.length>0){
			ret+='*';
			title+='\n...'+mark.msg.comment.replaceAll('"',"'");
		}
		ret='<span class="pkgmark pkgmark-'+mark.typ+'" title="'+title+'">'+ret+'</span>';
		return ret;
	}).join(',');
}
function generateHTML(pkgs,search,subreqTime){
	let html='';
	const header='<!doctype html><html><head><title>ArchRV PKG Status</title><style>body{margin:0;position:absolute;left:50%;transform:translateX(-50%);line-height:1.5;font-family:Consolas,Ubuntu Mono,Menlo,Monospace;}a{text-decoration:none;}th,td{text-align:left;vertical-align:top;padding:0.3rem;border-top:1px solid;}table{border-collapse:collapse;width:100%;margin-bottom:1rem;}span.pkgtag{font-size:0.8em;}span.pkgtag-legacy{color:#333;background-color:#bbb;}span.pkgtag-leaf{color:#fff;background-color:#555;}span.pkgtag-rotten{color:lightyellow;background-color:darkred;}span.subreqtime{font-size:0.8em;}tr.expand{font-size:0.8em;}td.expand{border-top-style:dashed;}td.expand-pre{border-top-style:dotted;padding-left:2%;}@media(prefers-color-scheme:light){body,.table{color:#333;background-color:white;}a{color:dodgerblue;}a:hover{color:blueviolet;}th,td{border-top-color:#ddd;}tr.pkgwork-add{background-color:lightpink;}tr.pkgwork-pr,tr.pkgwork-prrm,tr.pkgmark-upstreamed{background-color:lightblue;}tr.pkgwork-merged,tr.pkgmark-ready,tr.pkgmark-pending,tr.pkgmark-noqemu{background-color:lightgreen;}tr.pkgmark-outdated,tr.pkgmark-outdated_dep,tr.pkgmark-missing_dep,tr.pkgmark-ignore,tr.pkgmark-stuck{background-color:lightgray;}tr.pkgmark-unknown{background-color:yellow;}span.pkgmark-noqemu{background-color:gold;}}@media(prefers-color-scheme:dark){body,.table{color:white;background-color:#333;}a{color:cyan;}a:hover{color:gold;}th,td{border-top-color:white;}tr.pkgwork-add{background-color:mediumvioletred;}tr.pkgwork-pr,tr.pkgwork-prrm,tr.pkgmark-upstreamed{background-color:blueviolet;}tr.pkgwork-merged,tr.pkgmark-ready,tr.pkgmark-pending,tr.pkgmark-noqemu{background-color:olivedrab;}tr.pkgmark-outdated,tr.pkgmark-outdated_dep,tr.pkgmark-missing_dep,tr.pkgmark-ignore,tr.pkgmark-stuck{background-color:gray;}tr.pkgmark-unknown{background-color:chocolate;}span.pkgmark-noqemu{background-color:red;}}</style><script>function rewidth(){document.getElementsByTagName("body")[0].style.width=Math.min(100,1.1*window.innerHeight/window.innerWidth*100)+"%";};window.addEventListener("load",rewidth);window.addEventListener("resize",rewidth);</script></head><body><div>';
	const mid='</div><div><table><thead><tr><th scope="col">name</th><th scope="col">user</th><th scope="col">work</th><th scope="col">mark</th></tr></thead><tbody>';
	const footer='</tbody></table></body></html>';
	html+=header;
	html+=subreqTime.map(subreq=>{
		return'<span class="subreqtime"> -> Request to '
			+subreq.src+' used '+subreq.time+' ms.</span><br>';
	}).join('');
	html+=mid;
	pkgs=pkgs.filter(pkg=>{
		if(pkg.felix=='leaf'&&pkg.work.typ.length==0&&pkg.mark.length==0&&pkg.user.length==0)
			return false;
		const searchFuncList=[
			['name',(pkg,match)=>{return match.some(ele=>ele==pkg.name);}],
			['user',(pkg,match)=>{return match.some(ele=>ele==pkg.user);}],
			['work',(pkg,match)=>{return match.some(ele=>ele==pkg.work.typ);}],
			['mark',(pkg,match)=>{
				return match.some(ele=>pkg.mark.some(mark=>mark.typ==ele))
					||(match.some(ele=>ele=='')&&pkg.mark.length==0);
			}],
			['mkby',(pkg,match)=>{
				return match.some(ele=>pkg.mark.some(mark=>mark.msg.by==ele))
					||(match.some(ele=>ele=='')&&pkg.mark.length==0);
			}]
		];
		for(const searchFunc of searchFuncList)
			if(search[searchFunc[0]]!=null&&!searchFunc[1](pkg,search[searchFunc[0]]))
				return false;
		return true;
	});
	if(search.sort!=null){
		function emptyCmp(a,b){
			if(a==b)
				return 0;
			if(a=='')
				return 1;
			if(b=='')
				return-1;
			return(a<b?-1:1);
		}
		const sortFuncList={
			'name':(a,b)=>{return emptyCmp(a.name,b.name);},
			'user':(a,b)=>{return emptyCmp(a.user,b.user);},
			'work':(a,b)=>{return emptyCmp(a.work.typ,b.work.typ);},
			'mark':(a,b)=>{return emptyCmp(
				a.mark.map(mark=>mark.typ).join(),
				b.mark.map(mark=>mark.typ).join()
			);},
			'mkby':(a,b)=>{return emptyCmp(
				a.mark.map(mark=>mark.msg.by).join(),
				b.mark.map(mark=>mark.msg.by).join()
			);}
		};
		pkgs.sort((a,b)=>{
			for(const property of search.sort)
				if(sortFuncList[property]!=undefined){
					let c=sortFuncList[property](a,b);
					if(c!=0)
						return c;
				}
			return 0;
		});
	}
	const genFuncList=[
		genTabName,
		genTabUser,
		genTabWork,
		genTabMark
	];
	html+=pkgs.map((pkg)=>{
		let ret='';
		let trClass=(pkg.work.typ.length>0?'pkgwork-'+pkg.work.typ:'')
			+pkg.mark.map((mark)=>{return' pkgmark-'+mark.typ;}).join('');
		ret+='<tr class="'+trClass+'">';
		ret+=genFuncList.map((genFunc)=>{return'<td>'+genFunc(pkg)+'</td>';}).join('');
		ret+='</tr>';
		if(search.expandAllComments){
			trClass+=' expand';
			ret+=pkg.mark.map(mark=>{
				let expand='';
				if(mark.msg.comment.length>0){
					expand+='<tr class="'+trClass+'">';
					expand+='<td class="expand-pre">--> '+mark.typ+':</td>';
					expand+='<td class="expand" colspan="3">'
						+mark.msg.comment.replaceAll('\<','&lt;').replaceAll('\>','&gt;')+'</td>';
					expand+='</tr>';
				}
				return expand+'';
			}).join('');
		}
		return ret;
	}).join('');
	html+=footer;
	return html;
}
const routeList=[
	['/robots.txt',()=>{return new Response('Disallow: /',{
		status:200,
		headers:{'Content-Type':'text/plain;charset=UTF-8'}
	});}],
	['/favicon.ico',()=>{return new Response('',{
		status:302,
		headers:{'Location': 'https://riscv-notes.sh1mar.in/img/favicon.ico'}
	});}]
];
const FetchUA='PLCT::ArchRV.StatusWorker';
function emptyPkg(name){
	return{
		name:name,
		felix:'',
		user:'',
		work:{
			typ:'',
			prurl:'',
		},
		mark:[],
		rotten:''
	};
}
const subreqList={
	'FelixStatus':{
		url:'https://archriscv.felixc.at/.status/status.htm',
		init:{
			method:'GET',
			headers:{'User-Agent':FetchUA}
		},
		parser:async function(pkgs,rsp){
			rsp=await rsp.text();
			for(const match of rsp.matchAll(/\<a href=\'logs\/.*?\<\/a\>/g)){
				if(match[0].search('Outdated FTBFS Logs')!=-1)
					continue;
				let pkgname=match[0].substr(14);
				pkgname=pkgname.substr(0,pkgname.search('\''));
				if(pkgname[pkgname.length-1]=='/'){
					pkgname=pkgname.substr(0,pkgname.length-1);
					pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
					pkgs[pkgname].felix='dir';
				}else{
					pkgname=pkgname.substr(0,pkgname.length-4);
					pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
					pkgs[pkgname].felix='legacy';
				}
			}
			for(const match of rsp.matchAll(/[^\>]*\>[^\>]*\>Leaf package/g)){
				let pkgname=match[0].match(/^[^\<]*/g);
				if(pkgname==null)
					continue;
				pkgname=pkgname[0];
				pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
				pkgs[pkgname].felix='leaf';
			}
			return pkgs;
		}
	},
	'MelonBot':{
		url:'https://plct-arv.de2670dd.top/pkg',
		init:{
			method:'GET',
			headers:{'User-Agent':FetchUA}
		},
		parser:async function(pkgs,rsp){
			rsp=await rsp.json();
			rsp.workList.forEach(work=>{
				work.packages.forEach(pkgname=>{
					pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
					pkgs[pkgname].user=work.alias;
					pkgs[pkgname].work.typ='add';
				})
			});
			rsp.markList.forEach(pkg=>{
				if(pkg.marks.length==0)
					return;
				let pkgname=pkg.name;
				pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
				pkgs[pkgname].mark=pkg.marks.map(mark=>{return{
					typ:mark.name,
					msg:{
						by:mark.by.alias||'',
						comment:mark.comment||''
					}
				}});
			});
			return pkgs;
		}
	},
	'GHPullReq':{
		url:'https://api.github.com/repos/felixonmars/archriscv-packages/pulls?per_page=100',
		init:{
			method:'GET',
			headers:{
				'Authorization':'token '+GH_TOKEN,
				'User-Agent':FetchUA
			}
		},
		parser:async function(pkgs,rsp){
			rsp=await rsp.json();
			rsp.forEach(pull=>{
				let pkgname=pull.title.match(/(addpkg|updpkg|upgpkg|rmpkg|rmvpkg): [^ ]+/g);
				if(pkgname==null)
					return;
				let rm=(pkgname[0][0]=='r');
				pkgname=pkgname[0].substr(pkgname[0].search('pkg: ')+5);
				pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
				pkgs[pkgname].work.typ=(rm?'prrm':'pr');
				pkgs[pkgname].work.prurl=pull.html_url;
			});
			return pkgs;
		}
	},
	'GHRepoTree':{
		url:'https://api.github.com/repos/felixonmars/archriscv-packages/git/trees/master',
		init:{
			method:'GET',
			headers:{
				'Authorization':'token '+GH_TOKEN,
				'User-Agent':FetchUA
			}
		},
		parser:async function(pkgs,rsp){
			rsp=await rsp.json();
			rsp.tree.forEach(tree=>{
				if(tree.path==".github"||tree.type!="tree")
					return;
				let pkgname=tree.path;
				if(pkgs[pkgname]==undefined){
					pkgs[pkgname]=pkgs[pkgname]||new emptyPkg(pkgname);
					pkgs[pkgname].rotten='in-repo-only';
					return;
				}
				pkgs[pkgname].rotten='in-repo';
				if(pkgs[pkgname].work.typ!='pr'&&pkgs[pkgname].work.typ!='prrm')
					pkgs[pkgname].work.typ='merged';
			});
			return pkgs;
		}
	},
	'RottenCache':{
		url:'https://static.func.bond/'+ROTTEN_CACHE_TOKEN+'/rotten.log',
		init:{
			method:'GET',
			headers:{'User-Agent':FetchUA}
		},
		parser:async function(pkgs,rsp){
			rsp=await rsp.text();
			rsp=rsp.substr(rsp.search('__main__'));
			rsp=rsp.substr(rsp.search('\n')+1);
			for(const match of rsp.matchAll(/ [^ \r\n]*/g)){
				let pkgname=match[0].substr(1);
				if(pkgs[pkgname]==undefined)
					continue;
				pkgs[pkgname].rotten=true;
			}
			for(const pkgname in pkgs){
				if(pkgs[pkgname].rotten=='in-repo')
					pkgs[pkgname].rotten='';
				if(pkgs[pkgname].rotten=='in-repo-only')
					pkgs[pkgname]=undefined;
			}
			return pkgs;
		}
	}
};
async function handleRequest(request){
	const url=new URL(request.url);
	for(const route of routeList)
		if(url.pathname==route[0])
			return route[1]();
	const subreqStartTime=Date.now();
	let subreqInstance={};
	for(const subreq in subreqList)
		subreqInstance[subreq]=fetch(
			subreqList[subreq].url,
			subreqList[subreq].init
		).then((rsp)=>{return{
			rsp:rsp,
			subreqTime:Date.now()-subreqStartTime
		}});
	let pkgs={};
	let subreqTime=[];
	for(const subreq in subreqInstance){
		const r=await subreqInstance[subreq];
		try{
			if(!r.rsp.ok)
				throw r.rsp;
			pkgs=await subreqList[subreq].parser(pkgs,r.rsp);
		}catch(err){
			return new Response('Failed to fetch from '+subreq,{
				status:500
			});
		}
		subreqTime.push({
			src:subreq,
			time:r.subreqTime
		});
	}
	let search={};
	const queryStrList=['name','user','work','mark','mkby','sort'];
	for(const queryStr of queryStrList){
		if((search[queryStr]=url.searchParams.get(queryStr))!=null)
			search[queryStr]=search[queryStr].split(',');
	}
	const queryBoolList=['expandAllComments'];
	for(const queryBool of queryBoolList){
		if(url.searchParams.get(queryBool)!=null)
			search[queryBool]=true;
	}
	let pkgsArray=[];
	for(const pkg in pkgs)
		if(pkgs[pkg]!=undefined)
			pkgsArray.push(pkgs[pkg]);
	const html=generateHTML(pkgsArray,search,subreqTime);
	return new Response(html,{
		status:200,
		headers:{'Content-Type':'text/html;charset=UTF-8'}
	});
}
