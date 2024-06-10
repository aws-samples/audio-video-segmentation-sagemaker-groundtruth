import json

def lambda_handler(event, context):

    # Event received
    print("Received event: " + json.dumps(event, indent=2))

    # Get source if specified
    source = event['dataObject']['source'] if "source" in event['dataObject'] else None

    # Get source-ref if specified
    source_ref = event['dataObject']['source-ref'] if "source-ref" in event['dataObject'] else None

    # if source field present, take that otherwise take source-ref
    task_object = source if source is not None else source_ref
    
    transcribed_text = event['dataObject']['transcription'] if "transcription" in event['dataObject'] else None

    # Build response object
    output = {
        "taskInput": {
            "taskObject": task_object,
            "transcription": transcribed_text
        },
        "isHumanAnnotationRequired": "true"
    }

    print(output)
    # If neither source nor source-ref specified, mark the annotation failed
    if task_object is None:
        print(" Failed to pre-process {} !".format(event["labelingJobArn"]))
        output["isHumanAnnotationRequired"] = "false"

    return output

