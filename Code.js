/**
 * Handles a GET request and returns an HTML template for rendering.
 * Creates an HTML template from 'index.html' and evaluates it.
 * @param {Object} e - The event object representing the GET request.
 * @return {HtmlOutput} The evaluated HTML template to be displayed.
 */
function doGet(e) {
    // Convert the request parameters to a JavaScript object
    var params = JSON.stringify(e);
    params = JSON.parse(params);
    
    // Determine the action based on user authentication
    let action;
    let authData = buildUsers(); // Fetch user authentication data
    let currEmail = Session.getActiveUser().getEmail();
  
    let users = authData.users;
    
    if (authData.users.includes(currEmail)) {
      action = 'authenticated';
    } else {
      action = 'noaccess';
    }
    // Render different HTML templates based on the action
    switch (action) {
      case 'noaccess':
        return HtmlService.createTemplateFromFile('noaccess').evaluate();
      case 'authenticated':
        return HtmlService.createTemplateFromFile('index').evaluate();
      default:
        return HtmlService.createTemplateFromFile('default').evaluate();
    }
  }
  
  /**
   * Includes an HTML file's content.
   * Loads the content of the HTML file and returns it as an HTML output.
   * @param {string} filename - The name of the HTML file to include.
   * @return {HtmlOutput} The HTML content as an HTML output.
   */
  function include(filename) {
    // Load the content of the HTML file and return it as an HTML output.
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }
  
  /**
   * Retrieves submission and related data from the Canvas LMS based on a given URL.
   * Parses the URL to extract courseId, assignmentId, and studentId.
   * Fetches submission, assignment, grader, and grading history data from Canvas API.
   * Processes the data to provide a comprehensive submission history.
   * @param {string} url - The URL containing information about the submission.
   * @return {Object} An object containing the student's name and submission history.
   */
  async function getSubmission(url) {
    // Parse the URL to extract courseId, assignmentId, and studentId.
    let dat = parseLink(url);
    
    // Fetch the user information based on the studentId from Canvas LMS.
    let user = await CanvasAPILibrary.findUserById(dat.studentId, dat.instance)[0];
  
    // Fetch the submission data based on the courseId, assignmentId, and studentId from Canvas LMS.
    let submission = await CanvasAPILibrary.getUserAssignmentSubmissions(dat.courseId, dat.assignmentId, dat.studentId, dat.instance);
  
    // Fetch assignment information based on courseId and assignmentId from Canvas LMS.
    let assignment = await CanvasAPILibrary.findAssignmentsById(dat.courseId, dat.assignmentId, dat.instance)[0];
  
    // Fetch submission grading history based on courseId, assignmentId, and studentId from Canvas LMS.
    let gradingHistory = await CanvasAPILibrary.getSubmissionGrading(dat.courseId, dat.assignmentId, dat.studentId, dat.instance);
  
    
    
    // Filter the grading history to get only those submissions that have been graded by someone.
    let subGrading = gradingHistory.filter(item => item.id === submission.id && item.grader_id !== null);
  
    // Loop through each graded submission and process the data.
    for (let i = 0; i < subGrading.length; i++) {
      // Initialize the gradeBefore variable to store the previous grade.
      let gradeBefore = 0;
    
      // If not the first graded submission, get the grade of the previous submission.
      if (i > 0) {
        gradeBefore = subGrading[i - 1].grade;
      }
  
      
  
      // Fetch grader information based on the grader_id from Canvas LMS.
      let grader = await CanvasAPILibrary.findUserById(subGrading[i].grader_id,dat.instance)[0];
  
      // Add additional properties to the submission data for better readability.
      subGrading[i]['grader_name'] = grader.name;
      subGrading[i]['assignment_name'] = assignment.name;
      subGrading[i]['grade_before'] = `${gradeBefore}/${assignment.points_possible}`;
      subGrading[i]['grade_after'] = `${subGrading[i].score}/${assignment.points_possible}`;
      subGrading[i]['grade_current'] = `${submission.score}/${assignment.points_possible}`;
    }
  
    // Prepare the return object with relevant data.
    let returnObj = {
      student_name: user.name,
      submissions: subGrading
    };
    
    // Log the data for debugging purposes.
    // Logger.log(subGrading);
    // Logger.log(returnObj);
  
    // Return the data as the result of the function.
    return returnObj;
  }
  
  /**
   * Parses a URL to extract courseId, assignmentId, and studentId.
   * @param {string} link - The URL to parse.
   * @return {Object} An object containing extracted courseId, assignmentId, and studentId.
   */
  function parseLink(link) {
    var urlParts = link.split("/");
    
    let instance;
  
    if (link.includes("ensign")) {
      instance = "ensign";
    } else {
      instance = "byui"
    }
  
    // Extract the courseId from the 5th part of the URL.
    var courseId = urlParts[4];
  
    var paramsPart = link.split("?")[1];
    var paramsParts = paramsPart.split("&");
  
    // Extract the assignmentId and studentId from the params.
    var assignmentId = paramsParts[0].split("=")[1];
    var studentId = paramsParts[1].split("=")[1];
  
    // Return an object containing the extracted data.
    return {
      courseId: courseId,
      assignmentId: assignmentId,
      studentId: studentId,
      instance: instance
    };
  }
  
  /**
   * Returns the email address of the currently logged-in user.
   * @return {string} - The email address of the user.
   */
  function userEmail() {
    return Session.getActiveUser().getEmail();
  }
  
  /**
   * Includes the content of the specified HTML file.
   * @param {string} filename - The name of the HTML file to include.
   * @return {string} - The content of the HTML file.
   */
  function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }
  
  /**
   * Builds and returns a user authentication data object.
   * Fetches approved users and their assigned courses from a Google Spreadsheet.
   * @return {Object} - The user authentication data object.
   */
  function buildUsers() {
    
    let ss = SpreadsheetApp.openById('1Bs7G0u5hDAt52rYwLrqs1fB1Ogkha_VsTZDCWt-Dfdk');
    
    // Fetch approved user information
    let approvedUsers = ss.getSheetByName('Approved Users');
    let userCount = CanvasAPILibrary.countRows(approvedUsers, "A2:A");
    let userValues = approvedUsers.getRange(2, 1, userCount).getValues();
    let users = [];
    
    // Populate the users array with approved user email addresses
    for (let i = 0; i < userValues.length; i++) {
      users.push(userValues[i][0]);
    }
    
    // Build the user authentication data object
    let userList = {};
  
    userList['users'] = users;
    Logger.log(userList); // Log the user authentication data for debugging
    return userList;
  }
  