
module.exports = {
  nmapSync: function (ips,ports) {
    return nmapSync(ips,ports);
  },

  nmap: function(ips,ports,call) {
    nmap(ips,ports,call);
  },

  httpScan: function(ips,ports,paths,callBack){
    httpScan(ips,ports,paths,callBack)
  }
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




/**
 * Verifica para cada host se ele possui alguma url com video
 */
function httpScan(ips,ports,paths,callBack){
	var hosts = httpHostsConstruct(ips);
    
    ports = ports.split(",");
	var hosts_filtrados = [];
	var completes = 0;
	var httpTest = require('http');
	for (var i = 0; i < hosts.length; i++){
		host = hosts[i];
		
		for (var y = 0; y < paths.length; y++){

            for (var x = 0; x < ports.length; x++){
                
                var options = {
                    host: host,
                    port: ports[x],
                    path: paths[y]
                };

                httpTest.get(options, function(resp){
                    
                    console.log("Test:"+resp.req._headers.host+resp.req.path+" - "+resp.statusCode);
                    
                    if (resp.statusCode == 200){
                        
                        host_part = resp.req._headers.host.split(":");
                        if (host_part[1] == undefined){//quando é na porta 80 ele nao coloca porta nenhuma
                            host_part[1] = 80;
                        }
                        if (scan.hostExistsIn(host_part[0],hosts_filtrados) == false){
                            
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
                }).setTimeout(1500,function(){
                    completes++;
                    this.abort();
                    //console.log("Timeout");
                });
            }
		}
	}
	
	
	var interval = setInterval(function(){
		console.log("Procurando hosts...");
        //Apos varrer todos os enderecos
		if (completes >= (hosts.length * paths.length * ports.length)){
			clearInterval(interval);
			//chama callback
            console.log(hosts_filtrados)
			callBack(hosts_filtrados);
		}
	}, 500);

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

var ipv4 = require('./ipv4');
var scan = require('./scan');



function httpHostsConstruct(ipStr){
    ips = ipStr.split(" ");
    var list = [];
    for (var y = 0; y < ips.length; y++){
        var ipAddr = ips[y];
        
        //Se for um ip escolhido pelo usuario
        if (ipAddr.indexOf("/") == -1){
            list.push(ipAddr);
            continue;
        }
        //Se nao for
        var begin_end = ipv4.getIpRangeNetMask(ipAddr);
        var ip = begin_end[0];
        
        list.push(ip);
        while (ip != begin_end[1]){
            
            var parts = ip.split(".");
            
            parts[3] = parseInt(parts[3]) + 1;
            if (parts[3] == 256){
                parts[3] = 0;
                parts[2] = parseInt(parts[2]) + 1;
                if (parts[2] == 256){
                    parts[2] = 0;
                    parts[1] = parseInt(parts[1]) + 1;
                    if (parts[1] == 256){
                        parts[1] = 0;
                        parts[0] = parseInt(parts[0]) + 1;
                    }
                }
            }

            ip = parts[0]+"."+parts[1]+"."+parts[2]+"."+parts[3];
            list.push(ip);
        }
    }
    return list;
}


/*var ips = "192.168.0.0/24";
var ports = "80,8080,8081,4747";
var paths = ['/video','/image/jpeg.cgi','/mjpeg',"/live.jpeg","/screen_stream.mjpeg","/videofeed","/mjpegfeed?640x480","/cam/1/frame.jpg"];

//data = httpHostsConstruct(ips,ports);
data = httpScan(ips,ports,paths);
console.log(data);*/