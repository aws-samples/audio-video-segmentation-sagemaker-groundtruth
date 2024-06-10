import json
import sys
from s3_helper import S3Client


def lambda_handler(event, context):
    # Event received
    print("Received event: " + json.dumps(event, indent=2))

    labeling_job_arn = event["labelingJobArn"]
    label_attribute_name = event["labelAttributeName"]

    label_categories = None
    if "label_categories" in event:
        label_categories = event["labelCategories"]
        print(" Label Categories are : " + label_categories)

    payload = event["payload"]
    role_arn = event["roleArn"]

    output_config = None  # Output s3 location. You can choose to write your annotation to this location
    if "outputConfig" in event:
        output_config = event["outputConfig"]

    # If you specified a KMS key in your labeling job, you can use the key to write
    # consolidated_output to s3 location specified in outputConfig.
    kms_key_id = None
    if "kmsKeyId" in event:
        kms_key_id = event["kmsKeyId"]

    # Create s3 client object
    s3_client = S3Client(role_arn, kms_key_id)

    # Perform consolidation
    return do_consolidation(labeling_job_arn, payload, label_attribute_name, s3_client)

def do_consolidation(labeling_job_arn, payload, label_attribute_name, s3_client):

    # Extract payload data
    if "s3Uri" in payload:
        s3_ref = payload["s3Uri"]
        payload = json.loads(s3_client.get_object_from_s3(s3_ref))
        print(payload)

    # Payload data contains a list of data objects.
    # Iterate over it to consolidate annotations for individual data object.
    consolidated_output = []
    success_count = 0  # Number of data objects that were successfully consolidated
    failure_count = 0  # Number of data objects that failed in consolidation

    for p in range(len(payload)):
        response = None
        try:
            dataset_object_id = payload[p]['datasetObjectId']
            log_prefix = "[{}] data object id [{}] :".format(labeling_job_arn, dataset_object_id)
            print("{} Consolidating annotations BEGIN ".format(log_prefix))

            annotations = payload[p]['annotations']
            print("{} Received Annotations from all workers {}".format(log_prefix, annotations))

            consolidated_annotations = []

            # Iterate over annotations. Log all annotation to your CloudWatch logs
            for i in range(len(annotations)):
                worker_id = annotations[i]["workerId"]
                annotation_content = annotations[i]['annotationData'].get('content')
                annotation_s3_uri = annotations[i]['annotationData'].get('s3uri')
                annotation = annotation_content if annotation_s3_uri is None else s3_client.get_object_from_s3(annotation_s3_uri)
                annotation_from_single_worker = json.loads(annotation)

                print("{} Received Annotations from worker [{}] is [{}]"
                      .format(log_prefix, worker_id, annotation_from_single_worker))

                # Raw content for timestamp-related fields
                raw_content = annotation_content if annotation_s3_uri is None else annotation

                # Structure the annotations neatly for other fields
                structured_annotation = {
                    "workerId": worker_id,
                    "rawContent": raw_content,
                    "backgroundNoise": annotation_from_single_worker.get('backgroundNoise', {}),
                    "emotionTag": annotation_from_single_worker.get('emotiontag', ''),
                    "environmentalSounds": annotation_from_single_worker.get('environmentalSounds', {}),
                    "label": annotation_from_single_worker.get('label', ''),
                    "rate": annotation_from_single_worker.get('rate', {}),
                    "speakerGender": annotation_from_single_worker.get('speakerGender', {}),
                    "speechNonSpeech": annotation_from_single_worker.get('speechNonSpeech', {}),
                    "textTranslationFinal": annotation_from_single_worker.get('textTranslationFinal', '')
                }

                consolidated_annotations.append(structured_annotation)

            # Combine annotations from all workers into the final output
            consolidated_annotation = {
                "annotationsFromAllWorkers": consolidated_annotations
            }

            # Build consolidation response object for an individual data object
            response = {
                "datasetObjectId": dataset_object_id,
                "consolidatedAnnotation": {
                    "content": {
                        label_attribute_name: consolidated_annotation
                    }
                }
            }

            success_count += 1
            print("{} Consolidating annotations END ".format(log_prefix))

            # Append individual data object response to the list of responses.
            if response is not None:
                consolidated_output.append(response)

        except:
            failure_count += 1
            print(" Consolidation failed for dataobject {}".format(p))
            print(" Unexpected error: Consolidation failed." + str(sys.exc_info()[0]))

    print("Consolidation Complete. Success Count {}  Failure Count {}".format(success_count, failure_count))

    print(" -- Consolidated Output -- ")
    print(json.dumps(consolidated_output, indent=2))
    print(" ------------------------- ")
    return consolidated_output
