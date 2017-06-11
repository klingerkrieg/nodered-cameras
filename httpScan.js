module.exports = {
  httpScan: httpScan
}


var getIpRangeNetMask = require('./ipv4').getIpRangeNetMask;
var hostExistsIn = require('./scan').hostExistsIn;
var getPaths = require('./paths').getPaths;

/**
 * Realiza o escaneamento pela rede ja retornando hosts validos com enderecos testados
 */
function httpScan(ips,ports,callBack,context){
	var hosts = httpHostsConstruct(ips);

    var paths = getPaths();
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
                    
                    if (resp.statusCode == 200){

                        console.log("Test:"+resp.req._headers.host+resp.req.path+" - "+resp.statusCode);    
                        
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
                }).setTimeout(5000,function(){
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
			callBack(hosts_filtrados,context);
		}
	}, 500);

}



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
        var begin_end = getIpRangeNetMask(ipAddr);
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

/*
var ips = "192.168.0.0/24";
var ports = "80,8080,8081,4747";
var paths = ['/video','/image/jpeg.cgi','/mjpeg',"/live.jpeg","/screen_stream.mjpeg","/videofeed","/mjpegfeed?640x480","/cam/1/frame.jpg"];

//data = httpHostsConstruct(ips,ports);
httpScan(ips,ports,paths,function(data){
    console.log(data)
});*/