const Pitchfinder = require("pitchfinder");
const teoria = require("teoria");

const samples_per_beat = 16;

module.exports = {
    get_notes : function(buffer, time_signature_top, time_signature_bottom, tempo) {// see below for optional constructor parameters.

        console.log(time_signature_top);
        console.log(time_signature_bottom);

        const detectPitch = new Pitchfinder.AMDF();

        /*const decoded = WavDecoder.decode.sync(buffer); // get audio data from file using `wav-decoder`
        const float32Array = decoded.channelData[0]; // get a single channel of sound*/

        const float32Array = buffer.getChannelData(0);

        var frequencies = Pitchfinder.frequencies(detectPitch, float32Array, {
            tempo: tempo, // in BPM, defaults to 120
            quantization: samples_per_beat, // samples per beat, defaults to 4 (i.e. 16th notes)
                         // We assume users will not sing any faster than half beats
        });

        var notes = frequencies.map(freq => freq < 1109 && freq != null ?
                                {
                                    "freq" : freq,
                                    "note_name" : "" + teoria.note.fromFrequency(freq).note.name().toUpperCase()
                                                + teoria.note.fromFrequency(freq).note.octave()
                                                + teoria.note.fromFrequency(freq).note.accidental(),
                                } : {"freq" : 0, "note_name" : "rest"});
        console.log(notes);

        var combined = combine_notes(notes);
        console.log('Notes combined based on consecutive samples of the same note', JSON.parse(JSON.stringify(combined)));
        updateProgress("note-detection");

        var measures = measures_split(combined, time_signature_top);
        console.log('Notes divided into subarrays by measures', JSON.parse(JSON.stringify(measures)));

        var new_measures = note_types(measures, time_signature_bottom);
        console.log('Notes with assigned note types', JSON.parse(JSON.stringify(new_measures)));
        updateProgress("measure-detection");

        return new_measures;

    },
    combine_notes : combine_notes,
    measures : measures_split,
    note_types : note_types

}

/**
 *
 * @param {Object[]} notes - The notes sampled from the recorded audio
 * @param {number} notes[].freq - The frequency of the note in Hz
 * @param {string} notes[].note_name - The name of the note (ex. c4, f#5)
 *
 * @returns {Array} An array containing the note_name and the number of consecutive sampled frequencies
 *                  with the same note_name
 *
 */
function combine_notes(notes) {

    // Partition array into subarrays of 8 samples each (half a beat)
    var spliced_array = [];
    temp_arr = JSON.parse(JSON.stringify(notes));

    // Remove leading rests to better line up splicing samples into groups of eight (hopefully)
    var counter = 0;
    while (temp_arr[counter].note_name == "rest" && counter < temp_arr.length - 1) {
        counter++;
    }

    var no_rest = temp_arr.splice(counter, temp_arr.length);
    while (no_rest.length > 0) {
        spliced_array.push(no_rest.splice(0, 8));
    }
    
    var combined_notes = [];
    var median_notes = [];
    // Take the median of each subarray as the most central note the user was trying to input
    for (var i = 0; i < spliced_array.length; i++) {
        var note_obj = null;
        var split = JSON.parse(JSON.stringify(spliced_array[i]));
        
        split.sort(function(a, b) {
            return parseFloat(a.freq) - parseFloat(b.freq);
        });

        
        var mid1 = Math.floor((split.length - 1) / 2);
        var mid2 = Math.ceil((split.length - 1) / 2);
        if (split[mid1].note_name == "rest") {
            var median = split[mid2].freq;
        } else {
            var median = split[mid2].freq;
        }

        // Create note object of the median
        if (median == 0) {
            note_obj = {
                "note_name_full" : "rest",
                "note" : "rest",
                "freq" : median,
                "note_length" : 8
            }
        } else {
            var note = "" + teoria.note.fromFrequency(median).note.name().toUpperCase()
                        + teoria.note.fromFrequency(median).note.octave()
                        + teoria.note.fromFrequency(median).note.accidental(),
            note_obj = {
                "note_name_full" : note,
                "note" : note.split("")[0],
                "octave" : note.split("")[1],
                "accidental" : note.split("")[2],
                "freq" : median,
                "note_length" : 8
            }
        }

        median_notes.push(note_obj);
    }

    // Combine consecutive notes
    var note_obj = null;
    for (var i = 0; i < median_notes.length; i++) {
        var note = JSON.parse(JSON.stringify(median_notes[i]));
        
        if (note_obj == null) {
            note_obj = JSON.parse(JSON.stringify(note));
            continue;
        }
        // The index's note_name matches the current note being checked, add sizes
        if (note.note_name_full == note_obj.note_name_full) {
            note_obj.note_length += note.note_length;
        } else { // note_name does not match, reset note being checked and push the current note_obj
            combined_notes.push(note_obj);
            note_obj = null;
            --i;
        }

        if (i == median_notes.length - 1) {
            combined_notes.push(note_obj);
            note_obj = null;
        }
    }

    if (note_obj != null) {
        combined_notes.push(note_obj);
    }

    return combined_notes;

}


/**
 *
 * @param {Object[]} combined_notes - The notes sampled from the recorded audio and the length they were played
 * @param {number} combined_notes[].freq - The frequency of the note in Hz
 * @param {string} combined_notes[].note_name - The name of the note (ex. c4, f#5)
 * @param {number} combined_notes[].note_length - The number of samples a note was held (in 32 samples/beat)
 * @param {number} beats_per_measure - The number of beats per measure
 *
 * @returns {Array} The combined_notes array, with rounded lengths and sub-arrays of measures
 *
 */
function measures_split(combined_notes, beats_per_measure) {

    //Number of beats & samples per measure.  Needed to split array into measure
    samples_per_measure = beats_per_measure * samples_per_beat;

    measures_arr = []
    measure = []

    // Combine notes based on measure
    for (var i = 0; i < combined_notes.length; ++i) {
        note_obj = JSON.parse(JSON.stringify(combined_notes[i]));

        // Round length based on samples per beat (32 samples/beat --> 16 samples/8th beat)
        note_obj.note_length = 8 * Math.round(note_obj.note_length/8);

        // Add note to the current measure if enough samples remain open in the measure
        if (samples_per_measure - note_obj.note_length >= 0) {
            measure.push(note_obj);
            samples_per_measure -= note_obj.note_length;
        } else {
            /*
                If no more space remains in the measure to fit the entire note, 2 cases:
                1) If samples_per_measure > 0, there is space for a note in the measure.
                    cut the next note and put the front into the measure and the back
                    into the next measure.
                2) samples_per_measure = 0, add full measure, then place note into the next measure(s).
            */
            cut_length = note_obj.note_length - samples_per_measure;
            front_split = JSON.parse(JSON.stringify(note_obj));
            front_split.note_length = samples_per_measure;
            // Note is tied to a note split and placed in the next measure
            front_split.tied = true;
            if (samples_per_measure > 0)
                measure.push(front_split);
            back_split = JSON.parse(JSON.stringify(note_obj));
            back_split.note_length = cut_length;
            samples_per_measure = beats_per_measure * samples_per_beat;
            measures_arr.push(measure);
            measure = [];
            // Add back split of note to array to be evealuated next
            combined_notes.splice(i+1, 0, back_split);
        }
    }

    if (samples_per_measure > 4) {
        end_rest = {
            "note_name_full" : "rest",
            "note" : "rest",
            "note_length" : 8 * Math.round(samples_per_measure/8)
        }
        measure.push(end_rest);
    }
    measures_arr.push(measure);

    return measures_arr;
}


/**
 *
 * @param {Object[]} measures - The notes sampled from the recorded audio split into measure subarrays by beats
 * @param {number} measures[].note_length - The number of samples a note was held (in 32 samples/beat)
 * @param {number} one_beat - The note type that constitutes one beat (quarter, 8th, 16th, etc)
 *
 * @returns {Array} The measures array, with each note assigned a note_type (whole, half, quarter, etc)
 *
 */
function note_types(measures, one_beat) {

    var res = [];

    for (var i = 0; i < measures.length; ++i) {
        measure = JSON.parse(JSON.stringify(measures[i]));
        measure_updated = [];
        for (var j = 0; j < measure.length; ++j) {
            note_obj = JSON.parse(JSON.stringify(measure[j]));

            //Determine if a note was held for a full beat (32 * x length)
            rem = note_obj.note_length % samples_per_beat;
            //How many full beats was the note held
            quotient = parseInt(note_obj.note_length / samples_per_beat);

            note_obj.note_type = [];
            quotient_temp = quotient;
            //If note is held longer than a whole note lengths, split into as many tied whole notes
            //as possible
            while (quotient_temp - one_beat > 0) {
                note_obj.note_type.push(one_beat);
                quotient_temp -= one_beat;
            }

            //No remainder, this means a note was held for a full number of beats
            if (rem == 0) {
                //If the note beats are power of 2, can be represented as a single note
                if (Math.log2(quotient_temp) % 1 === 0) {
                    note_obj.note_type.push(quotient_temp);
                    measure_updated.push(note_obj);
                } else {
                    //Special case: note beats of 3 can be represented as a single note
                    if (quotient_temp == 3) {
                        note_obj.note_type.push(quotient_temp);
                        measure_updated.push(note_obj);
                    } else {
                        //Separate into largest power of 2 and what remains
                        low_pow = Math.pow(2,Math.floor(Math.log2(quotient_temp)));
                        rest = [quotient_temp - low_pow];
                        //Further break down until remainder is powers of 2 (or special case 3)
                        while (Math.log2(rest[rest.length - 1]) % 1 !== 0) {
                            temp = rest.pop();
                            if (temp == 3) {
                                rest.push(temp);
                                break;
                            }
                            pow = Math.pow(2,Math.floor(Math.log2(temp)));
                            rest.push(pow, temp - pow);
                        }
                        note_obj.note_type.push(low_pow, ...rest);
                        measure_updated.push(note_obj);
                    }
                }
            } else { //There is a remainder, was not held for a whole number of beats
                if (quotient_temp > 0) { //Only do this is there's full beats not accounted for
                    //Perform same steps as above
                    if (Math.log2(quotient_temp) % 1 === 0) {
                        note_obj.note_type.push(quotient_temp);
                    } else {
                        if (quotient_temp == 3) {
                            note_obj.note_type.push(quotient_temp);
                        } else {
                            low_pow = Math.pow(2,Math.floor(Math.log2(quotient_temp)));
                            rest = [quotient_temp - low_pow];
                            //Further break down until remainder is powers of 2 (or special case 3)
                            while (Math.log2(rest[rest.length - 1]) % 1 !== 0) {
                                temp = rest.pop();
                                if (temp == 3) {
                                    rest.push(temp);
                                    break;
                                }
                                pow = Math.pow(2,Math.floor(Math.log2(temp)));
                                rest.push(pow, temp - pow);
                            }
                            note_obj.note_type.push(low_pow, ...rest);
                        }
                    }
                }
                //Case: dotted single beat notes are valid (3/2 of a beat)
                if (note_obj.note_type.length != 0) {
                    var last = note_obj.note_type.pop();
                    if (last == 1 && rem == 8) {
                        note_obj.note_type.push(((last * samples_per_beat) + rem) + "/" + samples_per_beat);
                    } else {
                        //Add final fractional bit to the end
                        note_obj.note_type.push(last);
                        note_obj.note_type.push(rem + "/" + samples_per_beat);
                    }
                    measure_updated.push(note_obj);
                } else {
                    note_obj.note_type.push(rem + "/" + samples_per_beat);
                    measure_updated.push(note_obj);
                }
            }
        }
        res.push(measure_updated);
    }

    return res;

}
