"use strict";
tatool.controller("featureBindingCtrl", [
  "$scope",
  "service",
  function ($scope, service) {
    $scope.mainGridService = service.mainGridService;
    $scope.colorGridService = service.colorGridService;

    $scope.start = function () {
      //Create stimulus
      service.createStimulus();

      //Initialize Encoding phase
      service.setPhase("ENCODING");
      encodingTimeStep();
    };

    function encodingPhase() {
      service.colorGridService.hide();
      service.addStimuli();
      service.mainGridService.show();
      service.mainGridService.refresh();
      if (service.timerEnabled.propertyValue === true) {
        // service.trial.encodingDuration
        service.timeEncodingDuration.start(encodingTimeStep);
      }
      service.setPhase("MAINTENANCE");
    }

    function encodingTimeStep() {
      if (service.getPhase() == "ENCODING") {
        encodingPhase();
      } else if (service.getPhase() == "MAINTENANCE") {
        maintenancePhase();
      } else if (service.getPhase() == "RECALL") {
        recallPhase();
      } else {
        console.log("Invalid phase");
      }

      //service.stopExecution();
    }

    function maintenancePhase() {
      if (service.timeMaintenanceDuration.duration == 1000) {
        service.setPhase("RECALL");
      }

      service.timeMaintenanceDuration.start(encodingTimeStep);
      //Display blank screen
      service.mainGridService.hide();
      service.colorGridService.hide();
      service.mainGridService.clear().refresh();
      service.colorGridService.clear().refresh();
    }

    function recallPhase() {
      service.mainGridService.show();
      service.colorGridService.show();
      service.recallInterval();
      service.colorGridService.refresh();
      service.mainGridService.refresh();
      // Called when clicked on the cell directly
      $scope.userClick = function (cell, timing, $event) {
        if (cell) {
          var startTime = service.startTime || 0;
          if (cell.data.stimulusValue === service.trial.probe) {
            var response = 1;
            console.log("Match");
            console.log("Probed Stimulus: ", service.trial.probe);
            console.log(
              "Color selected (stimulusValue): ",
              cell.data.stimulusValue
            );
          } else {
            var response = 0;
            console.log("No match");
            console.log("Name: ", service.trial.probe);
            console.log("stimulusValue: ", cell.data.stimulusValue);
          }

          //Calculate response time
          var responseTime = timing - startTime;
          console.log("Response time: ", responseTime);

          // Save reaction time in the trial object
          service.trial.responseTime = responseTime;
          // Save selected response in the trial object
          service.trial.response = response;
          service.saveTrial();
          service.mainGridService.clear().refresh();
          service.mainGridService.hide();
          service.colorGridService.hide();
        }
      };
    }
  },
]);
