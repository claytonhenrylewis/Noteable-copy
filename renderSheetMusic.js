var ABCJS = require('abcjs');

var bottomLyics = false; // true if we want the lyrics displayed at the bottom
var initialOutput = "";

//prevent event listener from being attached before dom is ready
window.onload = function() {
    document.getElementById("download-sheet").addEventListener("click", sheetToPdf);
}

function testRenderSheetMusic() {
    document.getElementById("sheet-music-main-content").classList.remove("hidden");
    document.getElementById("input-main-content").classList.add("hidden");
    time_signature_top_num_input = 4;
    time_signature_bottom_num_input = 4;
    key_signature_input = 'G';
    var testArray = [
        [
            { note_name_full : "C4", note : "C", octave : "4", accidental : undefined, freq : 0, note_length : 32 , note_type : ["2", "1"]},
            { note_name_full : "F4#", note : "F", octave : "4", accidental : "#", freq : 0, note_length : 32 , note_type : ["1"]},
            { note_name_full : "F4", note : "F", octave : "4", accidental : undefined, freq : 0, note_length : 32 , note_type : ["1"]},
            { note_name_full : "F4", note : "F", octave : "4", accidental : undefined, freq : 0, note_length : 32 , note_type : ["1"]},
            { note_name_full : "F4#", note : "F", octave : "4", accidental : "#", freq : 0, note_length : 32 , note_type : ["1"]},
            { note_name_full : "E4b", note : "E", octave : "4", accidental : "b", freq : 0, note_length : 32 , note_type : ["1"]}
        ],
        [
            { note_name_full : "E4b", note : "E", octave : "4", accidental : "b", freq : 0, note_length : 32 , note_type : ["1"]},
            { note_name_full : "E4b", note : "E", octave : "4", accidental : "b", freq : 0, note_length : 32 , note_type : ["1"]}
        ]
    ];
    renderSheetMusic(testArray, [["hel", "lo"], ["its"], ["me"], ["I've"], ["been"], ["won","der","ing"], ["if"], ["after"], ["all"], ["this"], ["time"], ["youd"], ["like"], ["to"], ["meet"], ["to"], ["go"], ["over"], ["every", "thing"]]);
}

/*
 * Special characters to take note of:
 * ' (single quote): octave up
 * , (comma): octave down
 * ^ (carrot): sharp sign
 * _ (underscore): flat sign
 * = (equals): natural sign
 * - (hiphen): tie between A1_B1
 * z: rest
 * w: start of inline words
 * W: start of end of music words
 * M: time signature
 * L: what note gets a beat
 * K: key
 */

function renderSheetMusic(input, words) {
    initialInput = input; // used for switching the lyrics to bottom or not
    initialWords = words;

    // shift notes to the key. (i.e. changing Db to C# for key of D)
    input = changeNotesToKey(input);
    var text = ""; // will hold the text for each new line of sheet music
    var wordIndex = 0;
    var syllableIndex = 0;
    if (bottomLyics) {
        text = "W: ";
    } else {
        text = "w: ";
    }

    var output; // will hold final abcjs format for sheet music
    output = "M: " + time_signature_top_num_input + "/" + time_signature_bottom_num_input + "\n";
    output += "L: 1/" + time_signature_bottom_num_input + "\n";
    output += "Q: 1/" + time_signature_bottom_num_input + "=" + tempo_input + "\n";
    output += "K: " + key_signature_input + "\n";
    output += "";
    // one measure at a time
    for (var i = 0; i < input.length; i++) {
        // measureAccidentals holds the key as "C#", "Db", etc. as well as
        // the accidentals that happen in the measure "C4#", "D3b", etc.
        var accidentals = []; // keep track of accidentals in the measure. Resets every measure
        // one note at a time
        for (var j = 0; j < input[i].length; j++) {
            if (input[i][j].note == "rest") {
                // possible tie between rests
                for (var k = 0; k < input[i][j].note_type.length; k++) {
                    output += "z";
                    output += input[i][j].note_type[k];
                    // if there is more than 1 note:
                    if (k != input[i][j].note_type.length - 1) {
                        output += "-"; // add tie
                    }
                }
            } else {
                // add note, and possible tie between notes
                for (var k = 0; k < input[i][j].note_type.length; k++) {
                    // pseudocode:
                    /*
                     * if note is in accidentals list:
                     *    if note not in key:
                     *        add accidental, and overwrite note in accidental list
                     *    else if other type of note (b, #, natural) is in accidentals list:
                     *        add accidental and overwrite note type (C,D,E, etc.) in accidental list
                     */

                    // if accidentals list does not contain the specific note
                    if (!accidentals.includes(input[i][j].note_name_full)) {
                        // if the key does not contain the specific note
                        if (!withinKey(input[i][j])) {
                            // add accidental to output and adjust accidentals array
                            [accidentals, output] = addAccidental(input[i][j], accidentals, output);
                        } else if (accidentals.includes(input[i][j].note + input[i][j].octave) ||
                                   accidentals.includes(input[i][j].note + input[i][j].octave + "#") ||
                                   accidentals.includes(input[i][j].note + input[i][j].octave + "b")) {
                            // if the note is in the key, but there is
                            // an exisitng accidental causing problems
                            [accidentals, output] = addAccidental(input[i][j], accidentals, output);
                        }
                    }

                    // add note name
                    output += input[i][j].note;

                    // handle octave
                    if (input[i][j].octave < 4) {
                        var currentOctave = input[i][j].octave;
                        while (currentOctave < 4) {
                            output += ",";
                            currentOctave++;
                        }
                    } else {
                        var currentOctave = input[i][j].octave;
                        while (currentOctave > 4) {
                            output += "\'";
                            currentOctave--;
                        }
                    }

                    // add length for note
                    output += input[i][j].note_type[k];

                    // add syllable to note
                    if (k == 0 && wordIndex < words.length) { // only add text to first part of tied notes
                        if (syllableIndex < words[wordIndex].length) {
                            if (syllableIndex + 1 < words[wordIndex].length) {
                                // if more syllables in this word
                                text += words[wordIndex][syllableIndex];
                                if (!bottomLyics) {
                                    text += "- ";
                                }
                            } else {
                                text += words[wordIndex][syllableIndex] + " ";
                            }
                            syllableIndex++;
                            if (syllableIndex >= words[wordIndex].length) {
                                // go to the next word
                                wordIndex++;
                                syllableIndex = 0;
                            }
                        } else {
                            // shouldn't reach this point, but just in case move on to next word
                            wordIndex++;
                            syllableIndex = 0;
                        }
                    }
                    // possibly add the tie
                    if (k != input[i][j].note_type.length - 1) {
                        output += "-"; // add tie
                        if (!bottomLyics) {
                            text += "* "; // skip to next note for text
                        }
                    }
                }
            }
            if (input[i][j].hasOwnProperty('tied')) {
                if (input[i][j].tied == true) {
                    output += "-"
                }
            }
        }
        // possibly start a new measure
        if (i != input.length - 1) {
            output += "|"; // start a new measure only if not at the end
            if ((i + 1) % 4 == 0) {
                output += "\n"; // start a new line every 4 measures.
                output += (text + "\n"); // add line's text with new line character at end
                if (bottomLyics) {
                    text = "W: ";
                } else {
                    text = "w: ";
                }
            }
        }
    }
    output += "|\n";
    output += text;

    console.log(output);
    ABCJS.renderAbc("sheet-music", output); // attaches var abc to DOM element id="sheet-music"
    sheetToMidi(output);
}

function getKeyAccidentals() {
    var ret = [];
    switch (key_signature_input) {
        case "Ab":
            ret = ["Bb", "Eb", "Ab", "Db"];
            break;
        case "A":
            ret = ["F#", "C#", "G#"];
            break;
        case "Bb":
            ret = ["Bb", "Eb"];
            break;
        case "B":
            ret = ["F#", "C#", "G#", "D#", "A#"];
            break;
        case "C":
            ret = [];
            break;
        case "Cb":
            ret = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"];
            break;
        case "Db":
            ret = ["Bb", "Eb", "Ab", "Db", "Gb"];
            break;
        case "D":
            ret = ["F#", "C#"];
            break;
        case "Eb":
            ret = ["Bb", "Eb", "Ab"];
            break;
        case "E":
            ret = ["F#", "C#", "G#", "D#"];
            break;
        case "F":
            ret = ["Bb"];
            break;
        case "F#":
            ret = ["F#", "C#", "G#", "D#", "A#", "E#"];
            break;
        case "Gb":
            ret = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
            break;
        case "G":
            ret = ["F#"];
            break;
    }
    // console.log("accidentals in the key " + key_signature_input + " are " + ret);
    return ret;
}

/**
 * @param  input [a note object]
 * @return true if the given note is within the set key
 */
function withinKey(input) {
    // first check if a natural is in the key
    if (input.accidental == undefined) {
        if (getKeyAccidentals().includes(input.note + "#")) {
            return false;
        }
        if (getKeyAccidentals().includes(input.note + "b")) {
            return false;
        }
        return true; // example: the note D is in the key if D# and Db are not in the key
    } else {
        return getKeyAccidentals().includes(input.note + input.accidental);
    }
}

function addAccidental(input, accidentals, output) {
    // add accidental
    switch (input.accidental) {
        case undefined:
            output += "=";
            break;
        case "#":
            output += "^";
            break;
        case "b":
            output += "_";
            break;
    }
    // remove the sharp note if it exists
    if (accidentals.indexOf(input.note + input.octave + "#") >= 0) {
        var index = accidentals.indexOf(input.note + input.octave + "#");
        accidentals.splice(index, 1);
    }
    // remove the flat note flat if it exists
    if (accidentals.indexOf(input.note + input.octave + "b") >= 0) {
        var index = accidentals.indexOf(input.note + input.octave + "b");
        accidentals.splice(index, 1);
    }
    // remove the natural note if it exists
    if (accidentals.indexOf(input.note + input.octave) >= 0) {
        var index = accidentals.indexOf(input.note + input.octave + "#");
        accidentals.splice(index, 1);
    }
    accidentals.push(input.note_name_full);
    return [accidentals, output];
}

function changeNotesToKey(input) {
    var notePos = "ABCDEFG";
    // one measure at a time
    for (var i = 0; i < input.length; i++) {
        // one note at a time
        for (var j = 0; j < input[i].length; j++) {
            // if key is sharp or flat
            if (key_signature_input == "C" ||
                key_signature_input == "G" ||
                key_signature_input == "D" ||
                key_signature_input == "A" ||
                key_signature_input == "E" ||
                key_signature_input == "B" ||
                key_signature_input == "C#" ||
                key_signature_input == "F#") {
                // change flat notes to equivalent sharps
                // example: change Db to a C#
                if (input[i][j].accidental == "b") {
                    input[i][j].accidental = "#"; // chance all flats to sharps
                    // shift letter name back one
                    if (input[i][j].note == "A") {
                        input[i][j].note = "G";
                    } else {
                        input[i][j].note = notePos[notePos.indexOf(input[i][j].note) - 1];
                    }
                    input[i][j].note_name_full = input[i][j].note + input[i][j].octave + input[i][j].accidental;
                }
            } else {
                // change sharp notes to equivalent flats
                // example: change a C# to a Db
                if (input[i][j].accidental == "#") {
                    input[i][j].accidental = "b"; // chance all sharps to flats
                    // shift letter name forward one
                    if (input[i][j].note == "G") {
                        input[i][j].note = "A";
                    } else {
                        input[i][j].note = notePos[notePos.indexOf(input[i][j].note) + 1];
                    }
                    input[i][j].note_name_full = input[i][j].note + input[i][j].octave + input[i][j].accidental;
                }
            }

        }
    }
    return input;
}

function jankRetry() {
 
    // hide sheet music and go back to input screen
    document.getElementById("sheet-music-main-content").classList.add("hidden");
    document.getElementById("input-main-content").classList.remove("hidden");
    // hide the retry button and show the record button
    document.getElementById("retry-icon").classList.add("hidden");
    document.getElementById("mic-icon").classList.remove("hidden");
    // reset the progress bar
    progress = [0,0,0,0,0];
    document.getElementById("progress-fill").style.width = 1 + "%";
    
}

function sheetToPdf() {
    //var jspdf = require('jspdf');
    //var doc = new jspdf.jsPDF("p","mm","a4");
    //var divHeight = $('#sheet-music').height();
    //var divWidth = $('#sheet-music').width();
    //var ratio = divHeight / divWidth;
    var oldContents = document.body.innerHTML;
    var printContents = document.getElementById("sheet-music").innerHTML;

    if(printContents) {
        printContents = printContents.replace(/\r?\n|\r/g, '').trim();
    }

    //var canvas = document.createElement('canvas');
    //canvg(canvas, printContents);
    //var imgData = canvas.toDataURL('image/png');
    //var width = doc.internal.pageSize.getWidth();
    //var height = doc.internal.pageSize.getHeight();
    //height = ratio * width;
    //doc.addImage(imgData, 'PNG', 0, 0, width-20, height-10);

    //doc.save('sheetMusic.pdf');
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = oldContents;

    document.getElementById("download-sheet").addEventListener("click", sheetToPdf);
    document.getElementById("retry-icon").addEventListener("click",jankRetry);

}

function sheetToMidi(output) {
    var abcjsMidi = require("abcjs/midi");
    document.getElementById("download-midi").innerHTML = "";
    abcjsMidi.renderMidi(document.getElementById("download-midi"),output, {
      generateDownload:true,
      generateInline: false,
      downloadLabel:"Download MIDI"
  });
}

function toggleLyrics() {
    var checkbox = document.getElementById("bottom-lyrics").checked;
    if (checkbox) {
        bottomLyics = false;
    } else {
        bottomLyics = true;
    }
    renderSheetMusic(initialInput, initialWords);
}
