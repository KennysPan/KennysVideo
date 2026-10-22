use super::*;
use std::io::{Read, Write};
fn release_json(version: &str, source: Source) -> serde_json::Value {
    serde_json::json!({"tag_name":format!("v{version}"),"prerelease":false,"installer_sha256":"a".repeat(64),"assets":[{"name":format!("KennysVideo-{version}-x64-setup.exe"),"state":"uploaded","browser_download_url":installer_url(source,&format!("v{version}"),version)}]})
}
fn release(version: &str, source: Source) -> Release { serde_json::from_value(release_json(version,source)).unwrap() }
// Local HTTP stand-ins exercise the actual production client, not HTTP-client stubs.
fn server(status: u16, body: Vec<u8>, header_delay: Duration, chunk_delay: Duration) -> (String, std::thread::JoinHandle<()>) {
    let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let url=format!("http://{}/update",listener.local_addr().unwrap());
    let handle=std::thread::spawn(move || {
        let (mut stream,_)=listener.accept().unwrap();let mut request=[0;4096];let count=stream.read(&mut request).unwrap();assert!(String::from_utf8_lossy(&request[..count]).starts_with("GET /update HTTP/1.1"));
        std::thread::sleep(header_delay);
        if write!(stream,"HTTP/1.1 {} Test\r\nContent-Length: {}\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n",status,body.len()).is_err(){return;}
        for chunk in body.chunks(1024) {std::thread::sleep(chunk_delay);if stream.write_all(chunk).is_err(){break;}}
    });(url,handle)
}
#[test]
fn stable_versions_and_ready_assets() {
    for source in [Source::Github,Source::Gitee] {
        assert!(evaluate_release("1.1.7",release("1.1.10",source),source).unwrap().available);
        assert!(!evaluate_release("1.1.7",release("1.1.7",source),source).unwrap().available);
        assert!(!evaluate_release("1.1.7",release("1.1.6",source),source).unwrap().available);
        let mut r=release("1.1.8",source);r.assets.clear();assert!(evaluate_release("1.1.7",r,source).is_err());
        let mut r=release("1.1.8",source);r.assets[0].browser_download_url="https://evil.test/setup.exe".into();assert!(evaluate_release("1.1.7",r,source).is_err());
        let mut r=release("1.1.8",source);r.prerelease=true;assert!(evaluate_release("1.1.7",r,source).is_err());
    }
    for bad in ["1.2","1.2.3-beta","01.2.3","1.2.3.4"]{assert!(version_numbers(bad).is_err());}
    let mut r=release("1.1.8",Source::Gitee);r.installer_sha256=None;r.body=Some(format!("Notes\nKennysVideo-SHA256: {}\n","b".repeat(64)));r.assets[0].state=None;
    assert_eq!(evaluate_release("1.1.7",r,Source::Gitee).unwrap().sha256.unwrap(),"b".repeat(64));
}
#[tokio::test]
async fn github_fast_skips_gitee() {
    let (url,handle)=server(200,serde_json::to_vec(&release_json("1.1.8",Source::Github)).unwrap(),Duration::ZERO,Duration::ZERO);
    let result=check_sources("1.1.7",&url,"http://127.0.0.1:1",Duration::from_secs(1),Duration::from_secs(1)).await.unwrap();assert_eq!(result.source,Source::Github);handle.join().unwrap();
}
#[tokio::test]
async fn metadata_falls_back_on_failure_or_slow_body() {
    for (status,body,headers,chunk) in [
        (500,b"error".to_vec(),Duration::ZERO,Duration::ZERO),
        (404,b"{}".to_vec(),Duration::ZERO,Duration::ZERO),
        (200,b"not json".to_vec(),Duration::ZERO,Duration::ZERO),
        (200,serde_json::to_vec(&release_json("1.1.8",Source::Github)).unwrap(),Duration::from_millis(120),Duration::ZERO),
        (200,serde_json::to_vec(&release_json("1.1.8",Source::Github)).unwrap(),Duration::ZERO,Duration::from_millis(120)),
    ] {
        let (primary,a)=server(status,body,headers,chunk);let (fallback,b)=server(200,serde_json::to_vec(&release_json("1.1.8",Source::Gitee)).unwrap(),Duration::ZERO,Duration::ZERO);
        assert_eq!(check_sources("1.1.7",&primary,&fallback,Duration::from_millis(50),Duration::from_secs(1)).await.unwrap().source,Source::Gitee);a.join().unwrap();b.join().unwrap();
    }
    assert!(check_sources("1.1.7","http://127.0.0.1:1","http://127.0.0.1:1",Duration::from_millis(50),Duration::from_millis(50)).await.is_err());
}
#[tokio::test]
async fn installer_falls_back_and_checks_hash() {
    let mut bytes=vec![42;16*1024];bytes[..2].copy_from_slice(b"MZ");let hash=format!("{:x}",Sha256::digest(&bytes));
    let fast=TransferBudget{headers:Duration::from_secs(1),idle:Duration::from_secs(1),window:Duration::from_secs(1),min_bps:0};
    let strict=TransferBudget{headers:Duration::from_millis(50),idle:Duration::from_millis(50),window:Duration::from_millis(60),min_bps:100_000};
    for (status,data,headers,chunk) in [
        (500,b"error".to_vec(),Duration::ZERO,Duration::ZERO),
        (200,bytes.clone(),Duration::from_millis(120),Duration::ZERO),
        (200,bytes.clone(),Duration::ZERO,Duration::from_millis(120)),
        (200,bytes.clone(),Duration::ZERO,Duration::from_millis(25)),
        (200,b"MZcorrupted".to_vec(),Duration::ZERO,Duration::ZERO),
    ] {
        let (primary,a)=server(status,data,headers,chunk);let (fallback,b)=server(200,bytes.clone(),Duration::ZERO,Duration::ZERO);
        let (result,source)=download_sources(&primary,&fallback,&hash,Source::Github,strict,fast).await.unwrap();assert_eq!(source,Source::Gitee);assert_eq!(result,bytes);a.join().unwrap();b.join().unwrap();
    }
    let (primary,a)=server(200,bytes.clone(),Duration::ZERO,Duration::ZERO);assert_eq!(download_sources(&primary,"http://127.0.0.1:1",&hash,Source::Github,fast,fast).await.unwrap().1,Source::Github);a.join().unwrap();
    let (bad,a)=server(200,b"MZbad".to_vec(),Duration::ZERO,Duration::ZERO);assert!(download_sources(&bad,"http://127.0.0.1:1",&hash,Source::Gitee,fast,fast).await.is_err());a.join().unwrap();
}
#[tokio::test]
async fn streamed_progress_resets_on_fallback_and_never_claims_ready() {
    let mut bytes=vec![42;16*1024];bytes[..2].copy_from_slice(b"MZ");let hash=format!("{:x}",Sha256::digest(&bytes));
    let (primary,a)=server(200,bytes.clone(),Duration::ZERO,Duration::from_millis(25));
    let (fallback,b)=server(200,bytes.clone(),Duration::ZERO,Duration::from_millis(30));
    let strict=TransferBudget{headers:Duration::from_secs(1),idle:Duration::from_secs(1),window:Duration::from_millis(120),min_bps:100_000};
    let fast=TransferBudget{min_bps:0,..strict};
    let events=Mutex::new(Vec::new());
    let (_,source)=download_sources_with_progress(&primary,&fallback,&hash,Source::Github,strict,fast,&|event|events.lock().unwrap().push(event)).await.unwrap();
    assert_eq!(source,Source::Gitee);a.join().unwrap();b.join().unwrap();
    let events=events.lock().unwrap();
    assert!(events.iter().any(|p|p.source==Source::Github&&p.downloaded>0));
    let switched=events.iter().position(|p|p.stage=="fallback").unwrap();
    assert_eq!(events[switched].downloaded,0);
    let updates:Vec<_>=events[switched+1..].iter().filter(|p|p.stage=="downloading").collect();
    assert!(updates.len()>1);assert!(updates.windows(2).all(|p|p[0].downloaded<=p[1].downloaded));
    assert!(updates.iter().all(|p|p.source==Source::Gitee&&p.total==Some(bytes.len() as u64)));
    assert_eq!(events.last().unwrap().stage,"verifying");
    assert_eq!(events.last().unwrap().downloaded,bytes.len() as u64);
    assert!(!events.iter().any(|p|p.stage=="ready"));
}
#[tokio::test]
async fn progress_handles_missing_content_length_and_bad_checksum() {
    let bytes=b"MZunknown length".to_vec();let hash=format!("{:x}",Sha256::digest(&bytes));
    let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let url=format!("http://{}/update",listener.local_addr().unwrap());
    let handle=std::thread::spawn(move||{let(mut stream,_)=listener.accept().unwrap();let mut request=[0;4096];stream.read(&mut request).unwrap();stream.write_all(b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nMZunknown length").unwrap();});
    let budget=TransferBudget{headers:Duration::from_secs(1),idle:Duration::from_secs(1),window:Duration::from_secs(1),min_bps:0};
    let events=Mutex::new(Vec::new());
    download_one(&url,&hash,budget,Source::Gitee,&|p|events.lock().unwrap().push(p)).await.unwrap();handle.join().unwrap();
    assert!(events.lock().unwrap().iter().any(|p|p.stage=="downloading"&&p.total.is_none()));
    let (bad,handle)=server(200,bytes,Duration::ZERO,Duration::ZERO);
    assert!(download_one(&bad,&"a".repeat(64),budget,Source::Gitee,&|p|events.lock().unwrap().push(p)).await.is_err());handle.join().unwrap();
    assert!(!events.lock().unwrap().iter().any(|p|p.stage=="ready"));
}
#[tokio::test]
#[ignore = "Requires live access to GitHub and Gitee"]
async fn live_source_selection() {
    let result=check_sources("1.1.4",GITHUB_FEED,GITEE_FEED,GITHUB_WAIT,GITEE_WAIT).await.unwrap();assert!(result.available);println!("PASS live selected {:?}: {}",result.source,result.latest_version.unwrap());
}
#[tokio::test]
#[ignore = "Requires a published release with an installer checksum; downloads but never executes"]
async fn live_verified_installer_download() {
    let status=check_sources("1.1.4",GITHUB_FEED,GITEE_FEED,GITHUB_WAIT,GITEE_WAIT).await.unwrap();
    let version=status.latest_version.unwrap();let tag=status.tag.unwrap();let hash=status.sha256.expect("Published installer checksum");
    let (bytes,source)=download_sources(&installer_url(status.source,&tag,&version),&installer_url(Source::Gitee,&tag,&version),&hash,status.source,TransferBudget::for_source(status.source),TransferBudget::for_source(Source::Gitee)).await.unwrap();
    assert!(bytes.len()>1_000_000);println!("PASS live verified installer {} via {:?}: {} bytes; not executed",version,source,bytes.len());
}
