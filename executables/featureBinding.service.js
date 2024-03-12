"use strict";

tatool.factory("featureBinding", [
  "executableUtils",
  "gridServiceFactory",
  "timerUtils",
  "dbUtils",
  function (executableUtils, gridServiceFactory, timerUtils, dbUtils) {
    var featureBinding = executableUtils.createExecutable();

    var ENCODING_DURATION_DEFAULT = 200;
    var ENCODING_DURATIONS = [200, 500];
    var MAINTENANCE_DURATION_DEFAULT = 1000;
    var SET_SIZES = [2, 4, 6];
    var N_TRIALS = 10;

    featureBinding.prototype.init = function () {
      // executable initialization code goes here
      var promise = executableUtils.createPromise();
      // this.phase = "INIT";

      if (!this.timerEnabled) {
        this.timerEnabled = {
          propertyValue: true,
        };
      } else {
        this.timerEnabled.propertyValue =
          this.timerEnabled.propertyValue === true ? true : false;
      }

      // set sizes
      this.setSizes = this.setSizes
        ? this.setSizes.propertyValue.map(Number)
        : SET_SIZES;
      this.nTrials = this.nTrials ? this.nTrials : N_TRIALS;
      //console.log("Set Size (this.setSizes): ", this.setSizes);
      //console.log("Trial: ", this.nTrials);

      //Create a new grid serivce to allow cell by cell control of the triangles
      this.mainGridService = gridServiceFactory.createService(
        3,
        5,
        "mainGridService",
        this.stimuliPath,
        false
      );

      //Create a grid service to display the color pallette during recall phase to select the color of the triangle being probed
      this.colorGridService = gridServiceFactory.createService(
        1,
        6,
        "colorGridService",
        this.stimuliPath,
        true
      );

      //Trial Counter Property
      this.trialCounter = 0;

      // Create list of set sizes and encoding duration to ensure even distribution
      this.trialList = [];

      for (var i = 0; i < SET_SIZES.length; i++) {
        for (var j = 0; j < N_TRIALS; j++) {
          // Use ENCODING_DURATIONS alternately
          var encodingDuration = ENCODING_DURATIONS[j % 2];
          this.trialList.push({
            setSize: SET_SIZES[i],
            encodingDuration: encodingDuration,
          });
        }
      }

      this.trialList = executableUtils.shuffle(this.trialList);
      console.log("Trial List (init): ", this.trialList);
      //Set Timing Properties
      this.encodingDuration = this.encodingDuration
        ? this.encodingDuration
        : ENCODING_DURATION_DEFAULT;
      this.maintenanceDuration = this.blankDuration
        ? this.blankDuration
        : MAINTENANCE_DURATION_DEFAULT;
      //Create the encoding timer object
      this.timeEncodingDuration = timerUtils.createTimer(
        this.encodingDuration,
        true,
        this
      );

      //Create timer object for maintenance interval
      this.timeMaintenanceDuration = timerUtils.createTimer(
        this.maintenanceDuration,
        true,
        this
      );

      var self = this;
      executableUtils
        .getCSVResource(this.stimuliFile, true, this.stimuliPath)
        .then(
          function (list) {
            self.stimuliList = list;
            //console.log("stimuliList length: ", self.stimuliList.length);
            promise.resolve();
          },
          function (error) {
            promise.reject(error);
          }
        );
      return promise;
    };

    featureBinding.prototype.createStimulus = function () {
      // reset executable properties
      this.startTime = 0;
      this.endTime = 0;

      // create new trial
      this.trial = {};
      var n = executableUtils.getNext(this.trialList, this.trialCounter);
      this.trial.setSize = n.setSize;
      this.trial.encodingDuration = n.encodingDuration;
      this.timeEncodingDuration.duration = this.trial.encodingDuration;
      console.log(
        "trial.encodingDuration (createStimulus): ",
        this.trial.encodingDuration
      );
      console.log(
        "timeEncodingDuration(timer obj): ",
        this.timeEncodingDuration.duration
      );

      //this.encodingDuration = this.trial.encodingDuration;
      console.log("Trial Set Size (createStimulus): ", this.trial.setSize);

      //Shuffle the order of stimuli in the path
      this.shuffle_list = executableUtils.shuffle(this.stimuliList);
      // Filter the shuffle_list to remove empty or undefined elements (avoid the probe images to be added to as stimuli from the csv file)
      const getTriangles = this.shuffle_list.filter(
        (item) => item && item.stimulusType === "triangle"
      );
      //Store each stimulus along with its position and orientation in an object
      this.stimulus = {};
      //Create a list of allowed grid positions based on the rows and columns of this.mainGridService
      const allowedGridPositions = [1, 3, 5, 6, 10, 11, 13, 15];
      //Store the random position of the stimulus in an array
      this.random_pos = [];
      var usedLocations = new Set();
      // Initialize an array to store used orientation angles
      var usedAngles = [];
      var startTime = executableUtils.getTiming();
      // Loop through the stimuli list
      for (var i = 0; i < this.trial.setSize; i++) {
        var orientationAngle;
        do {
          //Generate a random grid position for the stimulus
          this.random_pos[i] =
            allowedGridPositions[
              Math.floor(Math.random() * allowedGridPositions.length)
            ];
          orientationAngle = 45 * Math.floor(Math.random() * 8); // Function to generate a random orientation angle at 45 degree increments
        } while (
          usedLocations.has(this.random_pos[i]) || //Ensure that grid position is not already used
          this.isOrientationUsed(usedAngles, orientationAngle) //Avoid being displayed exactly next to each other
        );
        // usedLocations.has(this.random_pos[i] + 1) || //Avoid being displayed exactly next to each other
        usedLocations.add(this.random_pos[i]); //Mark this position as used
        //usedLocations.add(this.random_pos[i] + 1); //Mark this position as adjacent to others
        usedAngles.push(orientationAngle); // Mark orientation angle as used

        // Define the CSS class based on the orientation angle to allow acess
        var stimulusAngle = `rotate-${orientationAngle}`;
        //Store the stimulus its position, and orientation angle in an object
        this.stimulus[getTriangles[i].stimulusValue] = {
          position: this.random_pos[i],
          orientation: orientationAngle,
        };

        //Create a data object for the addCellAtPosition() function containing the stimulus Value and valueType parameters. The gridCellClass parameter is used to define the CSS class to instantiate the orientation angle.
        this.setSizeData = {
          stimulusValue: getTriangles[i].stimulusValue,
          stimulusValueType: getTriangles[i].stimulusValueType,
          gridCellClass: stimulusAngle,
        };

        this.mainGridService.addCellAtPosition(
          this.random_pos[i],
          this.setSizeData
        ); //Add the stimulus to the grid
      }
    };

    //Iterate over the stimuli to be added to the grid, return a grid position of one of the stimuli
    featureBinding.prototype.addStimuli = function () {
      this.trialCounter++;
      //console.log("Trial Counter (addStimuli): ", this.trialCounter);
    };
    // Function to check if orientation angle has been used
    featureBinding.prototype.isOrientationUsed = function (usedAngles, angle) {
      return usedAngles.includes(angle);
    };

    featureBinding.prototype.getPhase = function () {
      return this.phase;
    };

    featureBinding.prototype.setPhase = function (phase) {
      this.phase = phase;
    };

    featureBinding.prototype.recallInterval = function () {
      //Function to randomly select a stimulus from the list of stimulus displayed during encoding
      var randomProperty = function (obj) {
        // var keys = Object.keys(obj);
        // return obj[keys[(keys.length * Math.random()) << 0]];
        let entries = Object.entries(obj);
        let randomEntry = entries[Math.floor(Math.random() * entries.length)];
        return randomEntry;
      };
      //Store the randomly chosen stimulus in an object: "probe"
      let probe = randomProperty(this.stimulus);

      //Destructure the probe object
      const {
        0: probeStimulusValue,
        1: { position: position, orientation: orientation },
      } = probe;

      //Store trial info of probe
      this.trial.probe = probeStimulusValue; //stimulusValue of the probed stimulus
      this.trial.probePosition = position; //location of the probed stimulus
      this.trial.probeOrientation = orientation; //orientation of the probed stimulus
      console.log(probeStimulusValue, position, orientation);
      console.log("Probe:  ", probe);
      var locationCue = {
        stimulusValue: "Probe_Circle.png",
        stimulusValueType: "image",
        myProperty: "myGridProbe",
      };
      var orientationCue = {
        stimulusValue: "Probe.png",
        stimulusValueType: "image",
        myProperty: "myGridProbe",
        gridCellClass: `rotate-${orientation}`,
      };

      let cueType = Math.random() < 0.5 ? "location" : "orientation";

      if (cueType === "location") {
        // show locationCue
        //Display the location cue at the grid position of the randomly selected stimulus
        this.mainGridService.addCellAtPosition(position, locationCue);
      } else {
        // show orientationCue
        //Display the oreintation cue at the center of the grid
        this.mainGridService.addCellAtPosition(8, orientationCue);
      }
      //Save the cue type
      this.trial.cueType = cueType;

      function addColorPosToGrid(stimulusValue, gridPosition, gridCellClass) {
        const colorPos = {
          stimulusValue,
          stimulusValueType: "text",
          gridPosition,
          gridCellClass,
        };

        this.colorGridService.addCell(colorPos);
      }

      addColorPosToGrid.call(this, "Red_Triangle.png", 1, "colorCell1");
      addColorPosToGrid.call(this, "Blue_Triangle.png", 2, "colorCell2");
      addColorPosToGrid.call(this, "Yellow_Triangle.png", 3, "colorCell3");
      addColorPosToGrid.call(this, "Violet_Triangle.png", 4, "colorCell4");
      addColorPosToGrid.call(this, "Green_Triangle.png", 5, "colorCell5");
      addColorPosToGrid.call(this, "Light_Blue_Triangle.png", 6, "colorCell6");

      this.startTime = executableUtils.getTiming();
      console.log("Start Time: ", this.startTime);
    };

    /*---------------------------------------------------------------------- */
    featureBinding.prototype.saveTrial = function () {
      //console.log("Trial Properties: ", this.trial);
      console.log("Trial Response", this.trial.response);
      console.log("Trial Num: ", this.trialCounter);
      return dbUtils.saveTrial(this.trial).then(executableUtils.stop);
    };

    // featureBinding.prototype.stopExecution = function () {
    //   //executableUtils.stop();
    // };
    return featureBinding;
  },
]);
