/* Function to check if view passed in is the current view */
function isCurrentView(v) {
  if (Session.get('currentView') === v) {
    return true;
  } else {
    return false;
  }
}

/* jobBoard template onCreated */
Template.jobBoard.onCreated(function() {
  this.searchQuery = new ReactiveVar('');
  this.limit = new ReactiveVar(10);
  this.jobsCount = new ReactiveVar(0);
  this.usersCount = new ReactiveVar(0);

  this.autorun(() => {
    this.subscribe('jobs.all', this.searchQuery.get(), this.limit.get());
    this.jobsCount.set(Counts.get('jobs.all'));

    this.subscribe('users.all', this.searchQuery.get(), this.limit.get());
    this.usersCount.set(Counts.get('users.all'));

    // Show allJobs view
    Session.set('currentView', 'allJobs');
    Session.set('selectedJob', '');
  });
});

/* jobBoard template helpers */
Template.jobBoard.helpers({
  showAllJobs: () => {
    return isCurrentView('allJobs');
  },
  showSingleJob: () => {
    return isCurrentView('singleJob');
  },
  showAddJob: () => {
    return isCurrentView('addJob') || isCurrentView('editJob');
  },
  jobs: () => {
    // Get all jobs, recently posted ones first
    return Jobs.find({}, {sort: {createdOn: -1 } });
  },
  hasMoreJobs: () => {
    return Template.instance().limit.get() <= Template.instance().jobsCount.get();
  },
  formatDate: (date) => {
    let currDate = moment(new Date()),
        postedDate = moment(new Date(date));

    let diff = currDate.diff(postedDate, 'days');

    if (diff === 0 && currDate.day() === postedDate.day()) {
      return 'Today';
    } else if (diff < 30) {
      if (diff <= 1) {
        return '1 day ago';
      } else {
        return diff + ' days ago';
      }
    } else {
      return '30+ days ago';
    }
  },
  isAuthor: (author) => {
    return Meteor.userId() === author;
  }
});

/* jobBoard template events */
Template.jobBoard.events({
  'click [data-id=load-more]': (event, template) => {
    template.limit.set(template.limit.get() + 20);
  },
  'keyup [data-id=search-jobs-query]': _.debounce((event, template) => {
    event.preventDefault();

    template.searchQuery.set(template.find('[data-id=search-jobs-query]').value);
    template.limit.set(20);
  }, 300),
  'submit [data-id=search-jobs-form]': (event, template) => {
    event.preventDefault();
  },
  'click #postJobButton': (event, template) => {
    Session.set('currentView', 'addJob');
  },
  'click .small-profile': (event, template) => {
    Session.set('selectedJob', event.currentTarget.id);
    Session.set('currentView', 'singleJob');
  },
  'click [data-id=edit-job]': (event, template) => {
    event.stopPropagation();

    Session.set('selectedJob', event.currentTarget.parentNode.id);
    Session.set('currentView', 'editJob');
  },
  'click [data-id=remove-job]': (event, template) => {
    event.stopPropagation();

    // Sweet Alert delete confirmation
    swal({
      title: 'Delete Event?',
      text: 'Are you sure that you want to delete this event?',
      type: 'error',
      showCancelButton: true,
      closeOnConfirm: true,
      cancelButtonText: 'No',
      confirmButtonText: 'Yes, delete it!',
      confirmButtonColor: '#da5347'
    }, function() {
      // Get the id of the job to be deleted
      let jobId = event.currentTarget.parentNode.id;

      // Make sure message exists
      let job = Jobs.findOne({ _id: jobId } );

      // If message exists
      if (job) {
        // Remove selected job
        Meteor.call('jobs.remove', jobId, (error, result) => {
          if (error) {
            Bert.alert('Event couldn\'t be deleted.', 'danger', 'growl-top-right');
          } else {
            Bert.alert('Event deleted', 'success', 'growl-top-right');
          }
        });
      } else {
        Bert.alert('Event couldn\'t be deleted.', 'danger', 'growl-top-right');
      }
    });
  }
});

/* singleJob template helpers */
Template.singleJob.helpers({
  getSingleJob: () => {
    return Jobs.findOne({ _id: Session.get('selectedJob') } );
  },
  formatDate: (date) => {
    return moment(date).format('MM/DD/YY');
  },
  notAuthor: (author) => {
    return Meteor.userId() !== author;
  }
});

/* singleJob template events */
Template.singleJob.events({
  'click .allJobsButton': (event, template) => {
    Session.set('currentView', 'allJobs');
  },
  'click #applyNowButton': (event, template) => {
    // Get job details
    let currJob = Jobs.findOne({ _id: Session.get('selectedJob') } );

    if (currJob.externalLink && currJob.externalLink !== '') {
      // Proceed to external link
      let link = currJob.externalLink;

      if (link.toString().indexOf('http://') === -1) {
        link = 'http://' + link;
      }

      window.open(link);
    } else {
      // Send message to job poster
      let authorName = Meteor.users.findOne({_id: currJob.author.toString()}).username,
          msg = "Hi, I'm interested in the event you posted titled \"" + currJob.title + ".\"";

      if (currJob.author && authorName) {
        Meteor.call('messages.insert', currJob.author, authorName, msg, (error, result) => {
          if (error) {
            Bert.alert(error.reason, 'danger', 'growl-top-right');
          } else {
            // Display success message and reset form values
            Bert.alert('Message sent to the event host.', 'success', 'growl-top-right');

            Session.set('currentView', 'allJobs');
          }
        });
      } else {
        Bert.alert('There was a problem sending the message.', 'danger', 'growl-top-right');
      }
    }
  }
});

/* addJob template onRendered */
Template.addJob.onRendered(function() {
  $('[data-id=addJob-submit]').addClass('disabled');
  Session.set('showExternalLink', false);

  if (isCurrentView('editJob')) {
    let jobToEdit = Jobs.findOne({ _id: Session.get('selectedJob') } );

    if (jobToEdit.externalLink && jobToEdit.externalLink !== '') {
      Session.set('showExternalLink', true);
      $('[data-id=addJob-interestedBehavior]').val('goToLink');
    } else {
      Session.set('showExternalLink', false);
      $('[data-id=addJob-interestedBehavior]').val('directMessage');
    }
      
    // Fill in fields with existing data
    $('[data-id=addJob-title]').val(jobToEdit.title);
    $('[data-id=addJob-location]').val(jobToEdit.location);
    $('[data-id=addJob-description]').val(jobToEdit.description);
    $('[data-id=addJob-responsibilities]').val(jobToEdit.responsibilities);
    $('[data-id=addJob-qualifications]').val(jobToEdit.qualifications);
    $('[data-id=addJob-schedule]').val(jobToEdit.schedule);
    $('[data-id=addJob-externalLink]').val(jobToEdit.externalLink);
      
    // Keep track of original values
    Session.set('startingTitle', $('[data-id=addJob-title]').val());
    Session.set('startingLocation', $('[data-id=addJob-location]').val());
    Session.set('startingDescription', $('[data-id=addJob-description]').val());
    Session.set('startingResponsibilities', $('[data-id=addJob-responsibilities]').val());
    Session.set('startingQualifications', $('[data-id=addJob-qualifications]').val());
    Session.set('startingSchedule', $('[data-id=addJob-schedule]').val());
    Session.set('startingLink', $('[data-id=addJob-externalLink]').val());

    // Change button text
    $('[data-id=addJob-submit]').prop('value', 'Save');
  } else if (isCurrentView('addJob')) {
    // Change button text
    $('[data-id=addJob-submit]').prop('value', 'Post');
  }
});

/* addJob template helpers */
Template.addJob.helpers({
  showExternalLink: () => {
    return Session.get('showExternalLink');
  }
});

/* addJob template events */
Template.addJob.events({
  'change [data-id=addJob-interestedBehavior]': (event, template) => {
    if (template.find('[data-id=addJob-interestedBehavior] option:selected').value === 'goToLink') {
      Session.set('showExternalLink', true);
    } else {
      Session.set('showExternalLink', false);
    }
  },
  'click .allJobsButton': (event, template) => {
    Session.set('currentView', 'allJobs');
  },
  'keyup [data-id=addJob-title], keyup [data-id=addJob-location], keyup [data-id=addJob-description], keyup [data-id=addJob-responsibilities], keyup [data-id=addJob-qualifications], change [data-id=addJob-schedule], change [data-id=addJob-interestedBehavior], keyup [data-id=addJob-externalLink]': (event, template) => {
    if (isCurrentView('addJob')) {
      try {
        // If job title, location, and description sections have text enable the submit button, else disable it
        if (template.find('[data-id=addJob-title]').value.toString().trim() !== '' &&
        template.find('[data-id=addJob-location]').value.toString().trim() !== '' &&
        template.find('[data-id=addJob-description]').value.toString().trim() !== '' &&
        (template.find('[data-id=addJob-interestedBehavior] option:selected').value.toString() === 'directMessage' ||
        (template.find('[data-id=addJob-interestedBehavior] option:selected').value.toString() === 'goToLink' &&
        template.find('[data-id=addJob-externalLink]').value.toString().trim() !== ''))) {
          $('[data-id=addJob-submit]').removeClass('disabled');
        } else {
          $('[data-id=addJob-submit]').addClass('disabled');
        }
      } catch(err) {
        $('[data-id=addJob-submit]').addClass('disabled');
      }
    } else if (isCurrentView('editJob')) {
      // If any of the values have changed enable the save button, else disable it
      if (template.find('[data-id=addJob-title]').value.toString().trim() !== Session.get('startingTitle') ||
      template.find('[data-id=addJob-location]').value.toString().trim() !== Session.get('startingLocation') ||
      template.find('[data-id=addJob-description]').value.toString().trim() !== Session.get('startingDescription') ||
      template.find('[data-id=addJob-responsibilities]').value.toString().trim() !== Session.get('startingResponsibilities') ||
      template.find('[data-id=addJob-qualifications]').value.toString().trim() !== Session.get('startingQualifications') ||
      template.find('[data-id=addJob-schedule]').value !== Session.get('startingSchedule') ||
      template.find('[data-id=addJob-externalLink]').value !== Session.get('startingLink')) {
        $('[data-id=addJob-submit]').removeClass('disabled');
      } else {
        $('[data-id=addJob-submit]').addClass('disabled');
      }
    }
  },
  'submit [data-id=addJob-form]': (event, template) => {
    event.preventDefault();

    // Only continue if button isn't disabled
    if (!$('[data-id=addJob-submit]').hasClass('disabled')) {
      // Get values
      let title = template.find('[data-id=addJob-title]').value.toString().trim(),
          location = template.find('[data-id=addJob-location]').value.toString().trim(),
          schedule = template.find('[data-id=addJob-schedule] option:selected').text.trim(),
          description = template.find('[data-id=addJob-description]').value.toString().trim(),
          responsibilities = template.find('[data-id=addJob-responsibilities]').value.toString().trim(),
          qualifications = template.find('[data-id=addJob-qualifications]').value.toString().trim(),
          externalLink = '';

      if (template.find('[data-id=addJob-interestedBehavior] option:selected').value.toString() === 'goToLink') {
        externalLink = template.find('[data-id=addJob-externalLink]').value.toString().trim();
      }

      if (isCurrentView('addJob')) {
        // Title, location and description should have text
        if (title && location && description) {
          Meteor.call('jobs.post', title, location, schedule, description, responsibilities,
          qualifications, externalLink, (error, result) => {
            if (error) {
              Bert.alert(error.reason, 'danger', 'growl-top-right');
            } else {
              // Display success message
              Bert.alert('Event posted', 'success', 'growl-top-right');

              // Switch the to allJobs view
              Session.set('currentView', 'allJobs');
            }
          });
        } else {
          Bert.alert('Please enter an event title, location and sport.', 'danger', 'growl-top-right');
        }
      } else if (isCurrentView('editJob')) {
        // Update existing job
        Meteor.call('jobs.update', Session.get('selectedJob'), title, location, schedule, description,
        responsibilities, qualifications, externalLink, (error, result) => {
          if (error) {
            Bert.alert(error.reason, 'danger', 'growl-top-right');
          } else {
            // Display success message
            Bert.alert('Event updated', 'success', 'growl-top-right');

            // Switch the to allJobs view
            Session.set('currentView', 'allJobs');
          }
        });
      }
    }
  }
});
