#!/usr/bin/env bash
export ORDER_SERVICE_NAME=grun

export PROJECT_ID=$(gcloud config get-value project)
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export PROJECT_NAME=$(gcloud projects describe $PROJECT_ID --format='value(name)')

# export UPLOAD_BUCKET=gs://menu-item-uploads-$PROJECT_ID
# export BUCKET_THUMBNAILS=gs://menu-item-thumbnails-$PROJECT_ID
# export TOPIC_ID=order-topic
# export ORDER_POINTS_TOPIC_ID=order-points-topic

gcloud config set project $PROJECT_ID

gcloud services enable \
    firestore.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --quiet
    # compute.googleapis.com \
    # appengine.googleapis.com \
    # sqladmin.googleapis.com \
    # vpcaccess.googleapis.com \
    # servicenetworking.googleapis.com \
    # spanner.googleapis.com \
    # alloydb.googleapis.com \

gcloud services enable \
    logging.googleapis.com \
    --quiet
    # vpcaccess.googleapis.com \
    # vision.googleapis.com \
    # cloudfunctions.googleapis.com \
    # iap.googleapis.com \
    # cloudresourcemanager.googleapis.com \
    # pubsub.googleapis.com \
    # workflows.googleapis.com \
    # workflowexecutions.googleapis.com \
    # eventarc.googleapis.com \
    # cloudscheduler.googleapis.com \

export REGION=us-central1
export WORKFLOW_LOCATION=$REGION
export TRIGGER_LOCATION=$REGION

# gcloud config set run/region $REGION

# gcloud config set compute/region $REGION

# gcloud config set workflows/location ${WORKFLOW_LOCATION}

# gcloud config set eventarc/location ${TRIGGER_LOCATION}

# gcloud auth configure-docker gcr.io -q