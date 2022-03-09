import { createSignal, Show, Switch, Match, onCleanup } from 'solid-js';
import adapter from 'webrtc-adapter';

import styles from './App.module.css';

// controls: pause, play, start, stop, reset, save, and time


const TimerComponent = (props) => {
	const [count, setCount] = createSignal(0);

  function gethms(milliseconds) {
    const off = new Date().getTimezoneOffset() * 60 * 1000;
    const hours = `0${new Date(milliseconds +off).getHours() -1}`.slice(-2);
    const minutes = `0${new Date(milliseconds +off).getMinutes()}`.slice(-2);
    const seconds = `0${new Date(milliseconds +off).getSeconds()}`.slice(-2);
    return `${hours}:${minutes}:${seconds}`;
  }

	const interval = setInterval(
		() => {
      if(!props.recordStoppedAt) {
        setCount( (new Date()).getTime() - props.recordStartedAt.getTime() )
      }else{
        setCount( props.recordStoppedAt.getTime() - props.recordStartedAt.getTime() )
      }
    },
		100
	);
	onCleanup(() => clearInterval(interval));
	return <div>{gethms(count())}</div>;
};


const TVideo = () => {


  let mediaRecorder;
  let recordedBlobs;
  let recordedVideo;
  let recordStartedAt;
  let recordStoppedAt;
  let savedVideoURL;

  const mediaFile = "video.webm";

  const theMimeType = "video/webm;codecs=h264";
  
  const [started, setStart] = createSignal(false); 
  const [canPlay, setPlay] = createSignal(false);
  const [inPlay, setInPlay] = createSignal(false);  
  const [uploaded, setUpload] = createSignal(false);   
  const [inRecording, setRecorded] = createSignal(false);
  const [linkReady, setLinkReady] = createSignal(false); 
   
  
  function handleSuccess(stream) {
    console.log('getUserMedia() got stream:', stream);
    (window).stream = stream;
    const vVideo = document.querySelector('#mainv'); 
    vVideo.srcObject = stream;
    vVideo.muted  = true;
  }

  function startRecording() {
    recordedBlobs = [];
    recordStartedAt = new Date();
    recordStoppedAt = 0;
    const mimeType = theMimeType;
    const options = {mimeType};

    if(mediaRecorder) {
      mediaRecorder.start();
      return;
    }  

    try {
      mediaRecorder = new MediaRecorder((window).stream, options);
      console.log(" mediaRecorder created");
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
      return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', recordedBlobs);
      // (window as any).stream.getVideoTracks()[0].stop();
    };
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
          recordedBlobs.push(event.data);
          console.log(event.data.size +  ' bytes saved..')
      }
  
    }
  
    mediaRecorder.start();
    console.log('Recorder started');
  }


    const cameraOff = () => {
      (window).stream.getAudioTracks()[0].enabled = false;
      console.log((window).stream.getAudioTracks());
    }

    const cameraOn = () => {
      (window).stream.getAudioTracks()[0].enabled = true;
      console.log((window).stream.getAudioTracks());
    }
    
    async function initVideo(constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          handleSuccess(stream);
        } catch (e) {
          console.error('navigator.getUserMedia error:', e);
        }
      }

    const start = () => {     
      if(!(window).stream) {
        const constraints = {
            audio: true,
            video: {
              width: 320, height: 240
            }
          };
        console.log('Using media constraints:', constraints);
        initVideo(constraints);
      }else{
        const vVideo = document.querySelector('#mainv'); 
        vVideo.srcObject = (window).stream;
        vVideo.muted  = true;
      }  
      setStart( true );
 
    } 
    
    const startRec = () => {
      if(uploaded()) {
        start();
        setStart( true );
      }  
      recordStoppedAt = 0;
      startRecording();
      cameraOn();
      setRecorded(true);       
    } 

    const deleteRec = () => {
      setPlay(false);
      setRecorded(false);  
      start();
    }     


    const stopRec = () => {
      recordStoppedAt = new Date();
      setRecorded( true );
      setPlay( true );
      setInPlay(false);
      mediaRecorder.stop();
      cameraOff();
      (document.querySelector('#mainv')).mute = false;
      console.log('Stopped recording...');
    }  

    const startPlay = () => {
      let recordedVideo;
      recordStoppedAt = 0;
      if(uploaded()) {
        recordedVideo = document.querySelector('#recorded');  
        recordedVideo.play(); 
      }else{    
        recordedVideo = document.querySelector('#mainv');        
        const mimeType = "video/webm";
        const buffer = new Blob(recordedBlobs, {type: mimeType});
        recordedVideo.src = null;
        recordedVideo.srcObject = null;
        recordedVideo.src = window.URL.createObjectURL(buffer);
        recordedVideo.controls = true;
        recordedVideo.onended = () => {
          console.log('Ended');  
          setInPlay(false);
        }
        recordedVideo.play();      
      }    
      setInPlay(true); 
    }      

    const stopPlay = () => {
      if(recordedVideo) {
        recordedVideo.controls = false;
      }  
      // recordedVideo.paused();
      setInPlay(false);
    }

    const upload = () => {
      sendData();
    }  

    const canvasCreate = (src) => {
        const canvas = document.querySelector('#s3');
        const context = canvas.getContext('2d');
        canvas.width = src.videoWidth || src.width;
        canvas.height = src.videoHeight || src.height;
        context.drawImage(src, 0, 0, canvas.width, canvas.height);
        src.addEventListener('play', () => {
          function step() {           
            context.drawImage(src, 0, 0, canvas.width, canvas.height)
            requestAnimationFrame(step)
          }
          requestAnimationFrame(step);
        })
        console.log(canvas.width, canvas.height);
    }    




    const sendData = () => {
    
     const mimeType = "video/webm";
     const buffer = new Blob(recordedBlobs, {type: mimeType});
     const formData = new FormData();

     formData.append("video", buffer);

     const request = new XMLHttpRequest();
     request.open("POST", "http://localhost:8080/storage");

     request.upload.addEventListener("progress", (e) => {
         const percent_completed = (e.loaded/e.total)*100;
         (document.querySelector("#progress")).innerHTML = `${percent_completed}% complete`;
     });

     request.addEventListener("load", (e) =>{
         if (request.status === 201){
            const data = JSON.parse(request.responseText);  
            savedVideoURL = `http://localhost:8080/storage/${data.resource_id}`;
           
            const recordedVideo = document.querySelector('#recorded');   

            recordedVideo.srcObject = null;
            recordedVideo.src = savedVideoURL;
            recordedVideo.setAttribute('crossOrigin', '');
            recordedVideo.muted =  true;
            recordedVideo.onloadeddata = () => {
              console.log("loaded video from S3");
              canvasCreate(recordedVideo);
              recordedVideo.play(); 
            };
            setUpload(true);
     
          //  recordedVideo.controls = true;
          
            setLinkReady(true);
            
             // (document.querySelector("#xlink") as any).innerHTML = `<a href="http://localhost:8080/storage/${data.resource_id}">Link to uploaded resource</a>`;
            return;
         }
         
         console.log(request.response)
     });

     request.send(formData); 
 }
  
//  

  return (
    <div class={styles.App}>
      <header class={styles.header}>
        Video App
     <Show when={inRecording() || canPlay() || uploaded()} >
        <TimerComponent recordStartedAt={recordStartedAt} recordStoppedAt={recordStoppedAt}/>
     </Show>
      </header>
    <div class={styles.main}>

        <div class={styles.video}>
                  
          <Show when={uploaded()} fallback={() => <video class="recording" id="mainv" playsinline autoplay ></video>}>
              <canvas id="s3"></canvas>
          </Show>  
          <video style="display:none" id="recorded" playsinline ></video>
        </div>
        <div>
        </div>
        <div class={styles.buttons}>
            <Show when={!started()} fallback={() => <button disabled>Start Cam</button>}>
                <button onClick={start}>Start Cam</button>        
            </Show>
            <Switch fallback={() => <button onClick={startRec}>Record</button>}>
              <Match when={!started() || canPlay()}>
                <button disabled onClick={startRec}>Record</button>
              </Match>
              {/*<Match when={!uploaded()}>
                <button disabled onClick={startRec}>Record</button>
  </Match>*/}              
              <Match when={inRecording()}>
                <button class="recording" onClick={stopRec}>Stop Recording</button>
              </Match>
            </Switch>

            <Show when={canPlay() } fallback={() => <button disabled>Play</button>}>
              <Show when={!inPlay() } fallback={() => <button onClick={stopPlay}>Stop</button>}>
                  <button onClick={startPlay}>Play</button>
              </Show>
              <Show when={!uploaded() } fallback={() => <button disabled onClick={deleteRec}>Delete</button>}>
                  <button onClick={deleteRec}>Delete</button>      
              </Show>  
            </Show>

            {/*<Show when={canPlay() } fallback={() => <button disabled>Save</button>}>
                <button onClick={save}>Save</button>        
            </Show> */}       
            <Show when={canPlay() && !uploaded() } fallback={() => <button disabled>Upload to S3</button>}>
                <button onClick={upload}>Upload to S3</button>       
                <form id="upload"/>
                <div id="progress"></div>
                {/* <Show when={linkReady()}>
                    <div id="xlink"></div>
                </Show> */}
            </Show>                   
  
        </div>
     </div>
    <div class={styles.bottom}>

    </div>


    </div>
  );
};

export default TVideo;
