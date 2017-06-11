
module.exports = {
  nmapSync: nmapSync,
  filtrarVideos: filtrarVideos,
  nmap: nmap
}


function nmapSync(ips,ports,call){
    const exec = require('child_process');
    
    nmapCmd = "nmap "+ips+" -p "+ports;
    
    var obj = exec.execSync(nmapCmd);
    stdout = obj.toString();
    return readResponse(stdout);
}

function nmap(ips,ports,call){
    const exec = require('child_process');
    
    nmapCmd = "nmap "+ips+" -p "+ports;
    var cmd = exec.exec(nmapCmd, function(error, stdout, stderr) {
        resp = readResponse(stdout);
        call(resp);
    });
}




function readResponse(stdout){
    //Removo a primeira linha
    stdout = stdout.trim()
    stdout = stdout.trim().substr(stdout.indexOf("\n")).trim();
    //Separo por hosts
    stdout = stdout.replace(/\r/g, '');
    var hosts = stdout.split("\n\n");
    //Descarto a ultima linha
    var data = [];
    var ipv4 = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/i
    var portOpen = /[0-9]{1,8}\/tcp[\s]{1,5}open/ig
    for (var i = 0; i < hosts.length-1; i++){

        var ip = ipv4.exec(hosts[i])[0];
        var ports = []
        do {
            open = portOpen.exec(hosts[i]);
            if (open != null){
                ports.push({"port":open[0].split("/")[0]});
            }
        } while(open);

        //adaptacao para funcionar igual ao implementado anteriormente
        if (ports.length == 0){
            ports = null;
        }
        
        data.push({'ip':ip,'openPorts':ports});
    }
    return data;
}



/**
 * Verifica para cada host se ele possui alguma url com video
 */
function filtrarVideos(hosts,scanCallBack,context){
	var hosts_filtrados = [];

	const hostExistsIn = require('./scan').hostExistsIn;

	var getPaths = require('./paths').getPaths;
	var paths = getPaths();
	
	var completes = 0;
	var httpTest = require('http');
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];

		if (host.protocol == 'rtsp'){
			//caso ele esteja no protocolo rtsp nao sera filtrado
			hosts_filtrados.push(host);
			completes += paths.length;//Soma para sair da espera
			continue;
		}
		
		for (var y = 0; y < paths.length; y++){
		
			
			var options = {
				host: host.ip,
				port: host.port,
				path: paths[y],
				timeout: 1000
			};
			
			httpTest.get(options, function(resp){
				
				console.log("Test:"+resp.req._headers.host+resp.req.path+" - "+resp.statusCode);
				
				if (resp.statusCode == 200){
					
					host_part = resp.req._headers.host.split(":");
					if (host_part[1] == undefined){//quando é na porta 80 ele nao coloca porta nenhuma
						host_part[1] = 80;
					}
					
					if (hostExistsIn(host_part[0],hosts_filtrados) == false){
						
						hosts_filtrados.push({ip:host_part[0],
											  port:host_part[1],
											  path:resp.req.path,
											  type:resp.headers['content-type'].split('/')[1],
											  protocol:"http"});
					}
					
				}
				completes++;
				this.abort();
				
			}).on("error", function(e,resp){
				completes++;
				//console.log("Got error: " + e.message);
			});
		}
	}
	

	
	//Espera as urls serem testadas
	var interval = setInterval(function(){
		console.log("Testando videos...");
		if (completes == (hosts.length * paths.length)){
			clearInterval(interval);
			scanCallBack(hosts_filtrados,context);
		}
	}, 500);
	
	
}


/*var ips = "192.168.0.0/24";
var ports = "80,8080,8081,4747";

data = nmapSync(ips,ports);
console.log(data);*/