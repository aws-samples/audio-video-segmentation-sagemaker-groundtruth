// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// This file is part of the AWS audio-video-segmentation-sagemaker-groundtruth project.
// https://github.com/aws-samples/audio-video-segmentation-sagemaker-groundtruth

var tagData = JSON.parse($('#document-metadata').text());
var video_source = $('#document-video').text().replace(/&amp;/g, '&');
console.log('Video Source: ' + video_source);
let currentRecording = null;        
var video = $('#video')[0];
var canvas = $('#drawcanvas')[0];
var txtSeparator = ': ';

function px(v) { return v + 'px'; }
function pc(v) { if (v < 0) v = 0; if (v > 100) v = 100; return Math.round(v) + '%'; }
function val(v) { v = parseFloat(v); if (isNaN(v)) v = 0; return v }
function ival(v) { return Math.floor(val(v)) }
function isarray(o) { return o instanceof Array; }
function isobj(o) { return o instanceof Object; }
function isnumber(o) { return typeof (o) == 'number' && !isNaN(o); }
function defined(o) { return typeof (o) != 'undefined'; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function getmsec() { return new Date().getTime(); }
function getsec() { return Math.round(getmsec() / 1000); }
function nullFunc() { return null; }

var wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#000000',
    progressColor: '#777777',
    barHeight: 1.5,
    keyboard: false
});


function tracks(domObj, videoObj, videoSource, tagData, reportObj) {
    wavesurfer.load(videoSource);
    // add video control panel
    tagData.startTimestamp = new Date().getTime();
    tagData.startUTCTime = new Date().toUTCString();
    var content = $('<div>');
    var modalHtml = $('<div class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="exampleModalCenterTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="modaltitle">Modal title</h5><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body" id="modalcontent"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button><button type="button" class="btn btn-primary" id="modalaction">Save changes</button></div></div></div></div>');
    content.append(modalHtml);
    // domObj.css({position:'relative'});
    var panel = $('<div>').prop('id', 'trackpanel').addClass('trackpanel centered text-center');
    var slider = $('<div>').prop('id', 'slider').addClass('trackslider');
    var sliderPos = $('<div>').prop('id', 'sliderpos').addClass('tracksliderpos');
    var vstart = $('<div>').prop('id', 'vstart').addClass('trackbutton').html('<i class="fa fa-fast-backward" aria-hidden="true"></i>');
    var vprev = $('<div>').prop('id', 'vprev').addClass('trackbutton').html('<i class="fa fa-step-backward" aria-hidden="true"></i>');
    var vplay = $('<div>').prop('id', 'vplay').addClass('trackbutton').html('<i class="fa fa-play" aria-hidden="true"></i>');
    var vpause = $('<div>').prop('id', 'vpause').addClass('trackbutton').html('<i class="fa fa-pause" aria-hidden="true"></i>');
    var vnext = $('<div>').prop('id', 'vnext').addClass('trackbutton').html('<i class="fa fa-step-forward" aria-hidden="true"></i>');
    var vend = $('<div>').prop('id', 'vend').addClass('trackbutton').html('<i class="fa fa-fast-forward" aria-hidden="true"></i>');

    var vspeed = $('<div>').addClass('trackright')
    var v05x = $('<div>').prop('id', 'v05x').addClass('trackrate v0').html('0.5X');
    var v1x = $('<div>').prop('id', 'v1x').addClass('trackrate v1').html('1X');
    var v2x = $('<div>').prop('id', 'v2x').addClass('trackrate v2').html('2X');
    var vpos = $('<div>').prop('id', 'vpos').addClass('trackleft').html('0:00.0');
    vspeed.append(v05x, v1x, v2x);

    var selectedTrack = null;
    var selectedRangeId = -1;
    var selectedRange = null;

    domObj.append(content);
    slider.append(sliderPos);
    panel.append(slider, vpos, vstart, vprev, vplay, vpause, vnext, vend, vspeed);
    panel.hide();
    content.append(panel);
    content.addClass('trackanotate');
    videoObj.addClass('trackvideo');
    var video = videoObj[0];
    sliderPos.css({ width: pc(0) });
    slider.click(function (e) {
        var pos = e.offsetX / slider.width() * video.duration;
        videoPos(pos);
        // console.log( pos, pos*video.duration );
    });
    video.ontimeupdate = videoPosUpdate;
    vplay.click(videoPlay);
    vpause.click(videoPause);
    vstart.click(function () { videoPos(0) });
    vend.click(function () { videoPos(video.duration) });
    vnext.click(videoForward);
    vprev.click(videoRewind);
    v05x.click(function () { videoRate(0.5) });
    v1x.click(function () { videoRate(1) });
    v2x.click(function () { videoRate(2) });
    var ruler = $('<div>').prop('id', 'trackruler').addClass('trackruler');
    var tcontrols = $('<div>').addClass('trackcontrol').html('');
    var cursor = $('<div>').prop('id', 'trackcursor').addClass('trackcursor');
    var tracks = $('<div>').addClass('tracklist');
    ruler.on('mousedown', rulerDn);
    ruler.on('mouseup', rulerUp);
    content.append(ruler, tcontrols, tracks, cursor);
    var isRecording = false;
    var recordingRanges = [];
    var czommIn = $('<div>').addClass('trackrulerzoommin').html('+').click(zoomIn);
    var czoomTxt = $('<div>').addClass('trackrulerzoomtxt').html('');
    var czoomOut = $('<div>').addClass('trackrulerzoomout').html('-').click(zoomOut);
    var cadd = $('<div>').addClass('trackaddbutton').html('Add New Track').click(addTrack);
    var crec = $('<div>').addClass('trackaddrecording').html('Begin Recording').click(recording);
    endRecording();
    tcontrols.append(czommIn, czoomTxt, czoomOut, cadd, crec);
    // video positioning functions

    var playTo = -1;
    function videoPosUpdate() {
        if (playTo != -1 && video.currentTime >= playTo) return stopplayback();
        var pos = video.currentTime / video.duration;
        // console.log( pos*100 );
        sliderPos.css({ width: pc(100 * pos) });
        if (video.paused && playing) videoPause();
        vpos.html(ftime(video.currentTime, 0) + ' / ' + ftime(video.duration, 0));
        posCursor();
        if (isRecording) {
            recordingRanges.forEach(function (rangeId) {
                var range = $('#' + rangeId)
                var r = range.prop('range');
                if (video.currentTime < r[0]) return endRecording();
                r[1] = video.currentTime;
                updateRange(range, r);
            });
        }
    }

    function videoPos(pos) {
        playTo = -1;
        video.currentTime = pos;
        // videoPosUpdate();
    }
    function videoPlay() {
        playing = true;
        video.play();
        vplay.hide();
        vpause.show();
    }
    function videoPause() {
        playing = false;
        video.pause();
        vplay.show();
        vpause.hide();
    }
    function videoForward() {
        var pos = video.currentTime + viewTotalLen / viewZoom / 20;
        video.currentTime = pos;
    }
    function videoRewind() {
        var pos = video.currentTime - viewTotalLen / viewZoom / 20;
        video.currentTime = pos;
    }
    function videoRate(r) {
        video.playbackRate = r;
        var sr = Math.floor(r).toString();
        $('.trackrate').removeClass('trackrateselected')
        $('.v' + sr).addClass('trackrateselected');
    }

    function ftime(t, precision) {
        if (typeof (t) != 'number' || t == 0 || isNaN(t)) t = 0;
        var m = Math.floor(t / 60);
        var h = Math.floor(m / 60);
        var s = Math.floor(t);
        var ms = t - s;
        if (precision) ms = ms.toFixed(precision).substr(1, 1000);
        else ms = '';
        // console.log( t, s, ms )
        // if( s < 10 ) return s+ms;
        s = s % 60;
        var ft = s.toString().padStart(2, '0') + ms;
        if (1) {
            if (m < 10) return m + ':' + ft;
            m = m % 60;
            ft = m.toString().padStart(2, '0') + ':' + ft;
        }
        if (h) {
            if (h < 10) return h + ':' + ft;
            h = h % 60;
            ft = h.toString().padStart(2, '0') + ':' + ft;
        }
        return ft;
    }

    zoom = 1;
    zoomStart = 0;
    zoomEnd = 1;
    video.src = videoSource;
    video.load();
    function videoCheckInit() {
        if (!video.duration) return setTimeout(videoCheckInit, 100);
        videoPause();
        videoPos(0);
        videoPosUpdate();
        videoRate(1);
        panel.show();
        $('.trackrange, .track').on('keydown', keyDown);
        $(document.body).on('keyup', keyUp);
        setHeight();
        viewTotalLen = video.duration;
        view(0, 1);
        zoomUpdate();
    }

    function setHeight() {
        var minh = 200;
        var top = content.position().top;
        var wh = $(window).height();
        // console.log( 'top', top,'wh', wh )
        var h = wh - top - 5;
        if (h < minh) h = minh;

        var cursorTop = ruler.position().top;
        var cursorHeight = wh - h + 1000;
        // console.log( 'cursorTop', cursorTop, cursorHeight );
        cursor.css({ top: px(cursorTop), height: px(cursorHeight) });

        content.css({ height: px(h) });
        contentHeight = h;
        contentWidth = content.width();
        var top = tracks.position().top;
        var wh = content.height();
        var h = wh - top - 10;
        // console.log( 'top', top,'wh', wh )
        tracks.css({ height: px(h), overflowY: 'auto' });
        // content.css()
        if (contentHeight != lastHeight || contentWidth != lastWidth) {
            lastHeight = contentHeight;
            lastWidth = contentWidth;
            view(viewPos, viewZoom);
        }
        clearTimeout(setHeightTid);
        setHeightTid = setTimeout(setHeight, 1000);
    }
    videoCheckInit();
    var playing = false;

    var lastKey = null;
    function keyUp(e) {
        if (!e.shiftKey) window.shiftKey = false;
        if (!e.ctrlKey) window.ctrlKey = false;
        if (!e.altKey) window.altKey = false;
    }

		function keyDown(e) {
		    var key = e.keyCode;
		    var dt = 1;
		    if (e.shiftKey) window.shiftKey = true;
		    if (e.ctrlKey) window.ctrlKey = true;
		    if (e.altKey) window.altKey = true;
		    if (key == lastKey) {
		        if ((now() - lastKeyTs) < 200)
		            var dt = 4 + lastDt++
		        else
		            var dt = lastDt = 1;
		    }
		    
		    // Handle space key for play/pause
		    if (key == 32) {
		        if (video.paused)
		            videoPlay();
		        else videoPause();
		        return false;
		    }
		    // Handle left arrow for rewind
		    else if (key == 37) {
		        videoRewind();
		    }
		    // Handle right arrow for forward
		    else if (key == 39) {
		        videoForward();
		    }
		    // Handle delete and backspace
		    else if (key === 46 || key === 8) { // 46 is Delete, 8 is Backspace
		        if ($(e.target).hasClass('trackrange')) {
		            e.preventDefault(); // Prevent default action
		            var confirmDelete = confirm("Are you sure you want to delete this range?");
		            if (confirmDelete) {
		                deleteRange($(e.target));
		            }
		            return false;
		        } else if ($(e.target).hasClass('track')) {
		            e.preventDefault(); // Prevent default action
		            var confirmDelete = confirm("Are you sure you want to delete this track?");
		            if (confirmDelete) {
		                deleteTrack($(e.target));
		            }
		            return false;
		        }
		    }
		    
		    // If we've reached this point, allow the default action
		    return true;
		}

    lastZoom = 0;
    viewPos = 0;
    viewOffset = 0;
    viewTotalLen = 0;
    viewZoom = 0;
    viewLeft = 0;
    setHeightTid = null;
    lastHeight = 0;
    lastWidth = 0;
    contentHeight = 0;
    contentWidth = 0;

    wavesurfer.mySeek = wavesurfer.seekTo;
    wavesurfer.seekTo = waveClick;

    function wavePos(pos, zoom) {
        var waveIniWid = 5000;
        var scale = contentWidth * zoom / waveIniWid;
        wavesurfer.myScale = scale;
        var nw = waveIniWid * scale;
        var baseLeft = -waveIniWid * (1 - scale) / 2 - pos * nw;
        console.log('scale', scale, 'baseLeft', baseLeft);
        $('#waveform').css({ 'transform': 'scalex(' + scale + ')', marginLeft: px(baseLeft) });
    }
    window.wavePos = wavePos;

    function waveClick(pos) {
        var rpos = pos / wavesurfer.myScale;
        console.log('pos', rpos);
        // wavesurfer.mySeek(rpos)
        video.currentTime = video.duration * rpos;
    }


    function view(pos, zoom) {
        // console.log( 'view', pos, zoom );
        viewZoom = zoom;
        viewPos = pos;
        var vsize = contentWidth * viewZoom;
        if (vsize != lastZoom) {
            drawTracks();
            lastZoom = vsize;
        }
        var dt = viewTotalLen / viewZoom;
        viewLeft = -contentWidth / dt * viewPos;
        var end = viewLeft + ruler.width();
        if (end < contentWidth) viewLeft += contentWidth - end;
        // console.log( 'margin', viewLeft, px(viewLeft) );
        ruler.css({ left: px(viewLeft) });
        $('.track').css({ left: px(viewLeft), width: px(ruler.width()) });
        $('.tracklabel').css({ left: px(-viewLeft) });
        var wPos = viewPos / viewTotalLen;
        var maxPos = 1 - 1 / viewZoom;
        if (wPos > maxPos) wPos = maxPos;
        wavePos(wPos, viewZoom)
        posCursor();
    }
    gruler = ruler;
    var followView = true;

    function posCursor() {
        if (video.currentTime == video.duration) {
            cursor.hide();
            return;
        }
        var dt = viewTotalLen / viewZoom;
        var cpos = contentWidth / dt * video.currentTime + viewLeft;
        cursor.css({ left: px(cpos) }).show();
        if (followView && cpos < 0 || cpos > contentWidth) {
            view(video.currentTime, viewZoom);
        }
        var wPos = video.currentTime / video.duration;
        wavesurfer.mySeek(wPos);
        // var l =
    }

    function calcTime(x) {
        var pos = x - ruler.offset().left;
        return pos / ruler.width() * viewTotalLen;
    }

    function rulerDn(e) {
        video.currentTime = calcTime(e.pageX);
    }

    function rulerUp(e) {

    }

    function modal(title, body, btnTxt, callback) {
        $('#modaltitle').html(title);
        if (typeof (body) == 'string') $('#modalcontent').html(body);
        else $('#modalcontent').html('').append(body);
        if (btnTxt) {
            $('#modalaction').show();
            $('#modalaction').html(btnTxt).unbind('click').click(function () {
                if (callback) callback();
                $('#modal').modal('hide');
            });
        }
        else {
            $('#modalaction').hide();
        }
        $('#modal').modal('show');
    }
    function modalWait(callback) {
        $('#modal').on('hidden.bs.modal', function () {
            $('#modal').unbind('hidden.bs.modal');
            callback();
        });
    }

    function addTrack() {
        function opt(name, val) { return $('<OPTION value="' + val + '">').html(name); }
        console.log('addTrack');

        var content = $('<DIV>');

        var chooseCategory = $('<DIV>').addClass('form-group').append($('<label for="selcategory">Select Category:</label>'));
        var category = $('<SELECT id="selcategory">').addClass('form-control');
        for (var c in tagData.categories)
            category.append(opt(c, c));

        var chooseTag = $('<DIV>').addClass('form-group').append($('<label for="seltag">Select Tag:</label>'));
        var tag = $('<SELECT id="seltag">').addClass('form-control');
        function selCateg(c) {
            console.log('selCateg', c);
            tag.html('');
            tagData.categories[c].forEach(function (t) {
                tag.append(opt(t, t));
            });
        }

        function add() {
            var tname = category.val() + txtSeparator + tag.val();
            console.log('add', category.val(), tag.val());
            if (tname in trackList) {
                return modalWait(function () {
                    modal('Add New Annotation Track',
                        "This track: <b>" + tname + "</b> is already added.<br>You can add new annotations to the same track.");
                });
            }
            setTrack(tname);
        }
        category.on('change', function () { selCateg($(this).val()) });
        selCateg(category.val());

        chooseCategory.append(category);
        chooseTag.append(tag);
        content.append(chooseCategory, chooseTag);
        modal('Add New Annotation Track', content, 'Add', add);
    }
		
		function report() {
		    if (!reportObj) return;
		    tagData.streams = {};
		    var ranges = [];
		    for (var t in trackList) {
		        trackList[t].forEach(function (r, idx) {
		            var id = simplify(t + txtSeparator + idx);
		            var c = t.split(txtSeparator)[0];
		            ranges.push({ 
		                start: r.start, 
		                end: r.end, 
		                id: id, 
		                tag: t, 
		                category: c, 
		                text: r.text || '', 
		                emotion: r.emotion || '' 
		            });
		        });
		    }
		    ranges.sort(function (a, b) {
		        if (a.category == b.category) {
		            if (a.start == b.start) return a.end > b.end ? 1 : -1;
		            return a.start > b.start ? 1 : -1;
		        } else return a.category > b.category ? 1 : -1;
		    });
		
		    reportObj.html('');
		    if (!ranges.length) return;
		    var tab = $('<TABLE>').addClass('reporttable');
		    var thead = $('<THEAD>');
		    var tr = $('<TR>');
		    tr.append($('<TH>').text('Start'));
		    tr.append($('<TH>').text('-'));
		    tr.append($('<TH>').text('End'));
		    tr.append($('<TH>').text('Tag'));
		    tr.append($('<TH>').text('Text'));
		    tr.append($('<TH>').text('Emotion'));
		    thead.append(tr);
		    tab.append(thead);
		    var streams = {};
		
		    ranges.forEach(function (r) {
		        var tmp = r.tag.split(txtSeparator);
		        var category = tmp[0];
		        var tag = tmp[1];
		        if (!streams[category]) streams[category] = [];
		        streams[category].push({ id: tag, start: r.start, end: r.end, text: r.text, emotion: r.emotion });
		        
		        var tr = $('<TR>').prop('id', 'report' + r.id).addClass('reporttr');
		        tr.append($('<TD>').text(ftime(r.start, 1)));
		        tr.append($('<TD>').text('-'));
		        tr.append($('<TD>').text(ftime(r.end, 1)));
		        tr.append($('<TD>').text(r.tag));
		
		        // Text area for transcript
		        var transcriptArea = $('<textarea>').attr({
		            name: 'label',
		            rows: 1,
		            cols: 20
		        }).val(r.text || '');
		        
		        
		        transcriptArea.on('keydown', function(event) {
    						event.stopPropagation();
						}).on('focus', function() {
    						unselectRange();
						});
        	 
        	  transcriptArea.on('focus', function() {
            		unselectRange();
        		});
		
		        // Dropdown for emotion
		        var dropdown = $('<select>').attr({
		            name: 'emotiontag',
		            class: 'custom-dropdown-width'
		        });
		        var dropdownOptions = ['Happy', 'Angry', 'Neutral', 'Sad', 'Worried'];
		        dropdownOptions.forEach(function(option) {
		            dropdown.append($('<option>').val(option).text(option));
		        });
		        dropdown.val(r.emotion || '');
		
		        tr.append($('<TD>').append(transcriptArea));
		        tr.append($('<TD>').append(dropdown));
		
		        // Event listeners for updating data
		        transcriptArea.on('input', function() {
		            r.text = $(this).val();
		            updateTrackListData(r);
		        });
		
		        dropdown.on('change', function() {
		            r.emotion = $(this).val();
		            updateTrackListData(r);
		        });
		
		        // Allow spaces in the textarea
		        transcriptArea.on('keydown', function (event) {
		            if (event.key === ' ') {
		                event.stopPropagation();
		            }
		        });
		
		        var deleteButton = $('<TD><i class="fa fa-trash"></i></TD>');
		        deleteButton.click(function (event) {
		            var element = $('#' + r.id);
		            if (element.length) {
		                deleteRange(element);
		            }
		            event.stopPropagation();
		        });
		
		        tr.append(deleteButton);
		        tab.append(tr);
		
		        tr.click(function () {
		            reportSelect(r.id);
		            var element = $('#' + r.id);
		            if (element.length) {
		                playRange(element);
		            }
		        });
		    });
		
		    tagData.streams = streams;
		    reportObj.html('').append(tab);
		}

		// Helper function to update trackList data
		function updateTrackListData(r) {
		    var tmp = r.tag.split(txtSeparator);
		    var category = tmp[0];
		    var tag = tmp[1];
		    var rangeIndex = trackList[r.tag].findIndex(function(range) {
		        return range.start === r.start && range.end === r.end;
		    });
		    if (rangeIndex !== -1) {
		        trackList[r.tag][rangeIndex].text = r.text;
		        trackList[r.tag][rangeIndex].emotion = r.emotion;
		    }
		}

		function reportSelect(id) {
		    $('.reporttr').removeClass('reportselected');
		    var element = $('#report' + id);
		    if (element.length) {
		        element.addClass('reportselected');
		    }
		}

    function reportUnselect() {
        $('.reporttr').removeClass('reportselected');
    }

		function fixTrack(tlist) {
		    if (!isarray(tlist)) tlist = [tlist];
		    tlist.forEach(function (track) {
		        var otrack = track;
		        
		        // Ensure the track is sanitized or a safe selector
		        if (typeof track === 'string' && track.match(/^[a-zA-Z0-9-_]+$/)) {
		            track = $('#' + track); // Assuming track is an id, adjust if it's a class or another selector
		        } else {
		            // Handle cases where track is not a simple string or needs different handling
		            track = $(track);
		        }
		        
		        var tname = track.prop('name');
		        var ranges = trackList[tname];
		        ranges.sort(function (a, b) {
		            if (a[0] == b[0]) return a[1] > b[1] ? 1 : -1;
		            return a[0] > b[0] ? 1 : -1;
		        });
		        var optimized = false;
		        do {
		            var again = false;
		            for (var i = 0; i < ranges.length - 1; i++) {
		                if (ranges[i][1] == ranges[i + 1][0]) {
		                    ranges[i][1] = ranges[i + 1][1];
		                    ranges.splice(i + 1, 1);
		                    optimized = again = 1;
		                    break;
		                } else if (ranges[i + 1][0] < ranges[i][1] && ranges[i + 1][1] < ranges[i][1]) {
		                    ranges.splice(i + 1, 1);
		                    optimized = again = 1;
		                    break;
		                } else if (ranges[i + 1][0] < ranges[i][1] && ranges[i + 1][1] >= ranges[i][1]) {
		                    ranges[i][1] = ranges[i + 1][1];
		                    ranges.splice(i + 1, 1);
		                    optimized = again = 1;
		                    break;
		                }
		            }
		        } while (again);
		    });
		    drawTracks();
		}
  
		function endRecording() {
		    console.log("Entering endRecording function");
		    if (!isRecording) {
		        console.log("Not recording, exiting endRecording");
		        return;
		    }
		    
		    isRecording = false;
		    crec.prop('rec', 0);
		    crec.removeClass('trackrecording');
		    crec.html('Begin Recording');
		    
		    if (!selectedTrack) {
		        console.log("No track selected, exiting endRecording");
		        return;
		    }
		    videoPause();
		    
		    console.log("Selected tracks:", selectedTrack);
		    selectedTrack.forEach(function (track) {
		        console.log("Processing track:", track);
		        var tname = $(track).prop('name');
		        console.log("Track name:", tname);
		        
		        if (trackList[tname] && trackList[tname].length > 0) {
		            // Update the last entry instead of creating a new one
		            var lastEntry = trackList[tname][trackList[tname].length - 1];
		            lastEntry.end = video.currentTime;
		            
		            console.log("Updated entry:", lastEntry);
		            
		            var idx = simplify(tname + txtSeparator + (trackList[tname].length - 1));
		            var r = $('#' + idx);
		            if (r.length) {
		                r.removeClass('trackrangerecording');
		                updateRange(r, lastEntry);
		            }
		        }
		    });
		    
		    recordingStartTime = null;
		    console.log("recordingStartTime reset to null");
		    
		    recordingRanges = [];
		    fixTrack(selectedTrack);
		    
		    console.log("Current trackList:", JSON.stringify(trackList, null, 2));
		    
		    report();
		    console.log("Exiting endRecording function");
		    unselectRange();
		}
	
		function beginRecording() {
		    if (!selectedTrack) return modal('Record Annotation', 'Select or add a track first');
		    isRecording = true;
		    recordingStartTime = video.currentTime;
		    crec.prop('rec', 1);
		    crec.addClass('trackrecording');
		    crec.html('Stop Recording');
		    
		    selectedTrack.forEach(function (track) {
		        var tname = $(track).prop('name');
		        if (!trackList[tname]) trackList[tname] = [];
		        
		        // Create a new entry object instead of an array
		        var newEntry = {
		            start: recordingStartTime,
		            end: recordingStartTime + 0.5, // This will be updated in endRecording
		            text: '',
		            emotion: ''
		        };
		        
		        trackList[tname].push(newEntry);
		        var idx = simplify(tname + txtSeparator + (trackList[tname].length - 1));
		        var r = addRange($(track), newEntry, idx);
		        r.addClass('trackrangerecording');
		        recordingRanges.push(r.prop('id'));
		    });
		    
		    playTo = -1;
		    videoPlay();
		    unselectRange();
		}



    function recording() {
        if (isRecording)
            endRecording()
        else
            beginRecording()
    }

		function zoomUpdate() {
		    czoomTxt.text(viewZoom.toFixed(0) + 'X');
		    view(viewPos, viewZoom);
		}


    function zoomIn() {
        if (viewZoom >= 256) return;
        viewZoom *= 2;
        // console.log( 'zoomIn', viewZoom );
        zoomUpdate();
    }

    function zoomOut() {
        if (viewZoom == 1) return;
        viewZoom /= 2;
        // console.log( 'zoomOut', viewZoom );
        zoomUpdate();
    }

    function simplify(s) {
        return s.replace(/[^0-9a-z]/ig, '_');
    }

    function playback(t1, t2) {
        videoPos(t1);
        playTo = t2;
        videoPlay();
    }

    function stopplayback() {
        video.pause();
        videoPos(playTo);
        playTo = -1;
        $('.trackrange').removeClass('trackrangeselected');
    }

    function calcPos(t) {
        return t / viewTotalLen * ruler.width();
    }

    var trackList = {};
    __trackList = trackList;

		function deleteRange(range) {
		    console.log(range);
		    var tname = range.prop('trackname');
		    var rangeData = range.prop('range');
		    var idx = trackList[tname].indexOf(rangeData);
		    if (idx >= 0) trackList[tname].splice(idx, 1);
		    console.log('deleterange', idx, trackList);
		    range.removeAttr('data-selected').remove();
		    drawTracks();
		    endRecording();
		}

    function moveRange(range, track) {
        var tname = range.prop('trackname');
        var r = range.prop('range');
        var rid = range.prop('idx');
        var newTrack = track.prop('name');
        var idx = trackList[tname].indexOf(r);
        if (idx >= 0) trackList[tname].splice(idx, 1);
        range.remove();
        rid = simplify(newTrack + '_' + 1000);
        trackList[newTrack].push(r);
        track.append(range);
        range.prop('id', rid);
        range.prop('idx', rid);
        range.prop('trackname', newTrack);
        range.prop('moved', true);
        // console.log( 'orig', tname, r, rid, track.prop('name'), idx );
    }

		function addRange(track, range, idx) {
		    var r = $('<div>').addClass('trackrange');
		    var tw = ruler.width();
		    var pl = calcPos(range.start);
		    var pr = calcPos(range.end);
		    var w = pr - pl;
		    r.css({ left: px(pl), width: px(w) });
		    var ml = $('<div>').addClass('trackrangemove trackrangemoveleft').css({ left: px(-5) });
		    var mr = $('<div>').addClass('trackrangemove trackrangemoveright').css({ right: px(-5) });
		    ml.on('mousedown', rangeMoveLeft);
		    mr.on('mousedown', rangeMoveRight);
		    r.prop('id', idx);
		    r.append(ml, mr);
		    r.prop('idx', idx).prop('track', track).prop('trackname', track.prop('name'));
		    r.prop('range', range);
		    if (idx == selectedRangeId) {
		        r.addClass('trackrangeselected');
		        selectedRange = r;
		    }
		    r.click(function () {
		        playRange($(this));
		        return false;
		    })
		    r.click(function (e) {
        		e.stopPropagation();
        		selectRange($(this));
        		playRange($(this));
        		return false;
    		});
		    r.on('mousedown', rangeDragStart);
		    track.append(r);
		    return r;
		}

    var rangeDragging = null;
    function rangeDragStart() {
        // console.log( 'dragstart')
        rangeDragging = $(this);
        $(document).on('mouseup', rangeDragEnd);
    }

    function rangeDragCheck() {
        if (!rangeDragging) return;
        // console.log( 'dragcheck', rangeDragging, $(this).prop('name'));
        moveRange(rangeDragging, $(this));
    }

    function rangeDragEnd() {
        $(document).unbind('mouseup');
        if (!rangeDragging.prop('moved')) {
            playRange(rangeDragging);
            selectRange(rangeDragging);
            rangeDragging = null;
            return false;
        }
        // console.log( 'dragend')
        var tname = rangeDragging.prop('trackname');
        var tid = 'track_' + simplify(tname);
        fixTrack($('#' + tid));
        rangeDragging = null;
    }

    function playRange(rangeObj) {
        reportSelect(rangeObj.prop('id'));
        var idx = rangeObj.prop('idx');
        selectRange(rangeObj);
        var range = rangeObj.prop('range');
        playback(range[0], range[1])
    }

		function deleteTrack(tlist) {
		    tlist.forEach(function (track) {
		        // Ensure that track is a DOM element or a jQuery object
		        if (typeof track === 'string') {
		            track = document.querySelector(track); // Use document.querySelector if track is a selector string
		        }
		        track = $(track);
		        var tname = track.prop('name');
		        if (trackList[tname] && trackList[tname].length) {
		            return modal('Delete Track', "Track is not empty. Delete all annotations before deleting a track.");
		        }
		        delete trackList[tname];
		        track.remove();
		        console.log('delete', tname, trackList);
		    });
		    unselectAll();
		    drawTracks();
		}

			
			function setTrack(tname, range, idx) {
			    var tid = 'track_' + simplify(tname);
			    var labid = 'label_' + tid;
			
			    // Ensure tid is a safe identifier before using it with jQuery
			    if (!$('#' + tid.replace(/[^\w-]/g, '\\$&')).length) {
			        var track = $('<div>').prop('id', tid).addClass('track').append($('<div>').prop('id', labid).addClass('tracklabel').text(tname));
			        track.prop('name', tname);
			        track.click(selectTrackClick);
			        tracks.append(track);
			    } else {
			        var track = $('#' + tid.replace(/[^\w-]/g, '\\$&'));
			    }
			
			    track.on('mouseenter', rangeDragCheck);
			
			    if (range) {
			        addRange(track, range, idx);
			    } else if (!(tname in trackList)) {
			        trackList[tname] = [];
			    }
			    
			    $('.trackempty').remove();
			}


    function unselectAll() {
        $('.trackrange').removeClass('trackrangeselected');
        $('.track').removeClass('trackselected');
        selectedTrack = null;
        selectedRangeId = -1;
        selectedRange = null;
    }

    function selectTrackClick() {
        var track = this;
        // console.log( 'TRACK', track )
        if (isRecording) endRecording();
        if (selectedTrack && selectedTrack.indexOf(track) >= 0) return unselectTrack(track);
        if (!window.shiftKey) unselectAll();
        selectTrack(track);
    }

    function unselectTrack(track) {
        if (isarray(track)) track = track[0];
        if (!selectedTrack) return;
        var idx = selectedTrack.indexOf(track);
        if (idx >= 0) selectedTrack.splice(idx, 1);
        $(track).removeClass('trackselected');
    }

    function selectTrack(track) {
        if (isarray(track)) track = track[0];
        // console.log( 'SELECTTRACK', track );
        if (window.shiftKey && selectedTrack && selectedTrack.indexOf(track) == -1) selectedTrack.push(track);
        else selectedTrack = [track];
        $('.track').removeClass('trackselected');
        selectedTrack.forEach(function (t) { $(t).addClass('trackselected') });
        // console.log( 'ssss', selectedTrack )
    }


    function updateRange(obj, r) {
        var pl = calcPos(r[0]);
        var w = calcPos(r[1]) - pl;
        obj.css({ left: px(pl), width: px(w) });
    }

		function selectRange(r) {
		    if (isRecording) endRecording();
		    $('.trackrange').removeClass('trackrangeselected').removeAttr('data-selected');
		    r.addClass('trackrangeselected').attr('data-selected', 'true');
		    selectTrack(r.prop('track')[0]);
		}
				    
		function unselectRange() {
		    selectedRange = null;
		    selectedRangeId = -1;
		    $('.trackrange').removeClass('trackrangeselected');
		    $('.reporttr').removeClass('reportselected');
		}

    if (!tagData.categories) tagData.categories = {};
    // console.log( 'tagData', tagData.streams );
    for (var c in tagData.streams) {
        if (!(c in tagData.categories)) tagData.categories[c] = [];
        var st = tagData.streams[c];
        st.forEach(function (s) {
            var key = c + txtSeparator + s.id;
            if (!(key in trackList)) trackList[key] = [];
            var range = [s.start, s.end]
            trackList[key].push(range);
        });
    }
    // console.log( trackList );

    function rangeMoveEnd() {
        console.log('rangeMoveEnd')
        $(document).unbind('mousemove');
        $(document).unbind('mouseup');
        video.pause();
        fixTrack(selectedTrack);
        return false;
    }

    var rangeMoving = false;
    var rangeSide = 0;
    var rangeMoveMin = 0;
    var rangeMoveMax = 99999999;
    var rangeMargin = 0.5;
    function rangeMoveRight() {
        if (isRecording) endRecording();
        console.log('rangeMoveRight')
        rangeMoving = true;
        rangeSide = 1;
        var rangeObj = $(this).parent()
        selectRange(rangeObj);
        var range = rangeObj.prop('range');
        var tname = rangeObj.prop('trackname');
        var rangeList = trackList[tname];
        var ridx = rangeList.indexOf(range);
        if (ridx == rangeList.length - 1) rangeMoveMax = video.duration;
        else rangeMoveMax = rangeList[ridx + 1][0];
        rangeMoveMin = range[0] + rangeMargin;
        console.log('right', rangeMoveMin, rangeMoveMax);

        $(document).on('mousemove', rangeMove);
        $(document).on('mouseup', rangeMoveEnd);
        return false;
    }
    function rangeMoveLeft() {
        if (isRecording) endRecording();
        console.log('rangeMoveLeft')
        rangeMoving = true;
        rangeSide = 0;
        var rangeObj = $(this).parent()
        selectRange(rangeObj);
        var range = rangeObj.prop('range');
        var tname = rangeObj.prop('trackname');
        var rangeList = trackList[tname];
        var ridx = rangeList.indexOf(range);
        if (ridx == 0) rangeMoveMin = 0;
        else rangeMoveMin = rangeList[ridx - 1][1];
        rangeMoveMax = range[1] - rangeMargin;
        console.log('left', rangeMoveMin, rangeMoveMax);

        $(document).on('mousemove', rangeMove);
        $(document).on('mouseup', rangeMoveEnd);
        return false;
    }
    function rangeMove(e) {
        var t = calcTime(e.pageX);
        if (t < rangeMoveMin) t = rangeMoveMin;
        else if (t > rangeMoveMax) t = rangeMoveMax;
        var r = selectedRange.prop('range');
        r[rangeSide] = t;
        updateRange(selectedRange, r);
        // console.log( t );
    }

    function drawTracks() {
        if (viewZoom == 0) return;
        var dt = viewTotalLen / viewZoom;
        var txtdiv = Math.floor(contentWidth / 120);
        var twid = contentWidth * viewZoom;
        // console.log( 'drawTracks', contentWidth, dt, 'txtdiv', txtdiv );
        function drawRuler() {
            ruler.html('');
            var tviews = [
                [1800, 300], // 30 minutos, divisao 5 min
                [600, 60], // 10 minutos, divisao 1 min
                [300, 60], // 5 minutos, divisao 30s
                [120, 10], // 2 minutos, divisao 10s
                [60, 5], // 1 minutos, divisao 5s
                [30, 5], // 30 segundos, divisao 2s
                [10, 1], // 10 segundos, divisao 1s
                [5, 0.5], // 5 segundos, divisao 0.5s
                [2, 0.2], // 2 segundos, divisao 0.2s
                [1, 0.1], // 1 segundo, divisao 0.1s
            ];
            for (var i = 0; i < tviews.length; i++) {
                // console.log( 'dt', dt, tviews[i], dt/tviews[i][0] )
                if (dt / tviews[i][0] >= txtdiv) break;
            }
            if (i == tviews.length) i--;
            var rulerView = i;
            ruler.css({ width: px(twid) });
            var rmark = tviews[rulerView][1];
            var rtxt = tviews[rulerView][0];
            var markdiv = Math.floor(viewTotalLen / rmark);
            var rwid = twid * (markdiv / (viewTotalLen / rmark))
            var markw = rwid / markdiv;
            for (var i = 0; i <= markdiv; i++)
                ruler.append($('<div>').addClass('trackrulermark').css({ left: px(i * markw) }));
            var labdiv = Math.floor(viewTotalLen / rtxt);
            var labw = markw * (rtxt / rmark);
            for (var i = 0; i <= labdiv; i++)
                ruler.append($('<div>').addClass('trackrulerlabel').css({ left: px(i * labw) }).html(ftime(i * rtxt)));
            // console.log( 'rulerView', rulerView, tviews[rulerView], labdiv );
        }
        drawRuler();
        $('.trackrange').remove();
        for (var c in trackList) {
            trackList[c].forEach(function (r, idx) {
                setTrack(c, r, simplify(c + txtSeparator + idx));
            })
        }
        $('.trackempty').remove();
        if (!Object.keys(trackList).length) tracks.html('').append($('<div>').html('no tracks').addClass('trackempty').css({ lineHeight: px(tracks.height()) }));

        report();
    }

}

		function saveAnnotations() {
		    var reasons = [];
		    var rchecks = $('.reason');
		    for (var i = 0; i < rchecks.length; i++)
		        reasons.push(rchecks[i].id);
		    var reasonToAbort = false;
		    tagData.endTimestamp = new Date().getTime();
		    tagData.endUTCTime = new Date().toUTCString();
		    tagData.elapsedTime = tagData.endTimestamp - tagData.startTimestamp;
		
		    reasons.forEach(function (r) {
		        if (!$('#' + r).prop('checked')) {
		            delete tagData[$('#' + r).attr('fieldname')];
		            return;
		        }
		        tagData[$('#' + r).attr('fieldname')] = true;
		        reasonToAbort = true;
		    });
		    if (Object.keys(tagData.streams).length == 0 && !reasonToAbort) {
		        alert('You need to add anotations to the video before submiting');
		        return null;
		    }
		    console.log(tagData);
		    return tagData;
		}

        var tr = new tracks($('#videotrackanotate'), $('#video'), video_source, tagData, $('#report'));


        document.querySelector('crowd-form').onsubmit = function () {
            var annotations = saveAnnotations();
            if (annotations)
                document.getElementById('annotations').value = JSON.stringify(annotations);
            else
                return false;
        };

        document.getElementById('submitButton').onclick = function () {
            document.querySelector('crowd-form').submit();
        };
        
document.addEventListener('DOMContentLoaded', (event) => {
    var textArea = document.getElementById('textTranslationFinalArea');
    if (textArea) {
        textArea.addEventListener('keydown', function(e) {
            if (e.code === 'Space' && e.target === this) {
                // Prevent the default action to stop Wavesurfer from playing
                e.stopPropagation();
            }
        }, true); // The "true" parameter ensures this event handler captures the event during the capturing phase, which occurs before the default action.
    }
});

$('#textTranslationFinalArea').on('keydown', function(e) {
    // Allow default behavior for all keys in this text area
    e.stopPropagation();
});

$(document).on('click', function(e) {
    if (!$(e.target).closest('.trackrange, .reporttr').length) {
        unselectRange();
    }
});