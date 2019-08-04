const im = require('imagemagick');
const fs = require('fs');
const os = require('os');
const uuidv4 = require('uuid/v4');
const { promisify } = require('util');
const AWS = require('aws-sdk');

const resizeAsync = promisify(im.resize);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);


AWS.config.update({ region: 'us-east-1' });
const s3 = new AWS.S3();

exports.handler = async (event) => {
    let filesProcessed = event.Records.map(async (record) => {
        let bucket = record.s3.bucket.name;
        let filename = record.s3.object.key;

        // Get file from var
        let params = {
            Bucket: bucket,
            Key: filename
        };

        let inputData = await s3.getObject(params).promise();

        // Resize the file (since our image magick 
        // doesnt support promises, we need to use a library called promisfy)
        // os.tempdir() gives us access to the temp dir on the lambda container env
        let tempFile = os.tmpdir() + '/' + uuidv4() + '.jpg';
        let resizeArgs = {
            srcData: inputData.Body,
            dstPath: tempFile,
            width: 150
        };
        await resizeAsync(resizeArgs);

        // Read the resized file
        let resizedData = await readFileAsync(tempFile);

        // Upload the new file form s3
        let targetFilename = filename.substring(0, filename.lastIndexOf('.')) + '-small.jpg';
        var params2 = {
            Bucket: bucket + '-dest',
            Key: targetFilename,
            Body: new Buffer(resizedData),
            ContentType: 'image/jpeg'
        };
        await s3.putObject(params2).promise();
        return await unlinkAsync(tempFile);
    });

    await Promise.all(filesProcessed);
    console.log("done");
    return "done";
};