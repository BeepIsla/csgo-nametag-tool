@ECHO OFF
SETLOCAL

SET "curdir=%~dp0"
FOR %%I IN ("%curdir%..") DO SET "rootdir=%%~fI"
ECHO %rootdir%
SET "protodir=%rootdir%\protobufs"
SET "outdir=%rootdir%\src\protobufs"

IF EXIST "%outdir%" RMDIR /S /Q "%outdir%"
MKDIR "%outdir%"
MKDIR "%outdir%\csgo"
MKDIR "%outdir%\steam"

"%curdir%protoc.exe" ^
	--plugin=protoc-gen-ts_proto="%rootdir%\node_modules\.bin\protoc-gen-ts_proto.cmd" ^
	--ts_proto_out="%outdir%\csgo" ^
    --proto_path="%protodir%\csgo" ^
	--ts_proto_opt=forceLong=bigint ^
	--ts_proto_opt=esModuleInterop=true ^
	--ts_proto_opt=env=node ^
	--ts_proto_opt=useOptionals=none ^
	--ts_proto_opt=exportCommonSymbols=true ^
	--ts_proto_opt=snakeToCamel=false ^
	--ts_proto_opt=outputJsonMethods=false ^
	--ts_proto_opt=outputSchema=const,outputSchema=no-file-descriptor ^
	--ts_proto_opt=importSuffix=.js ^
	--ts_proto_opt=disableProto2Optionals=true ^
	--ts_proto_opt=disableProto2DefaultValues=true ^
	base_gcmessages.proto ^
	cstrike15_gcmessages.proto ^
	econ_gcmessages.proto ^
	engine_gcmessages.proto ^
	gcsdk_gcmessages.proto ^
	gcsystemmsgs.proto ^
	steammessages.proto

"%curdir%protoc.exe" ^
	--plugin=protoc-gen-ts_proto="%rootdir%\node_modules\.bin\protoc-gen-ts_proto.cmd" ^
	--ts_proto_out="%outdir%\steam" ^
    --proto_path="%protodir%\steam" ^
	--ts_proto_opt=forceLong=bigint ^
	--ts_proto_opt=esModuleInterop=true ^
	--ts_proto_opt=env=node ^
	--ts_proto_opt=useOptionals=none ^
	--ts_proto_opt=exportCommonSymbols=true ^
	--ts_proto_opt=snakeToCamel=false ^
	--ts_proto_opt=outputJsonMethods=false ^
	--ts_proto_opt=outputSchema=const,outputSchema=no-file-descriptor ^
	--ts_proto_opt=importSuffix=.js ^
	--ts_proto_opt=disableProto2Optionals=true ^
	--ts_proto_opt=disableProto2DefaultValues=true ^
	enums_clientserver.proto ^
	steammessages_base.proto ^
	steammessages_clientserver_2.proto

ENDLOCAL
