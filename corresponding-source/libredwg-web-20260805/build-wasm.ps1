[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
    throw 'emcc was not found. Activate Emscripten 6.0.5 before running this script.'
}

$sourceRoot = $PSScriptRoot
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$objectRoot = Join-Path $resolvedOutput 'obj'
$sourceObjectRoot = Join-Path $objectRoot 'src'
$embindObjectRoot = Join-Path $objectRoot 'embind'

New-Item -ItemType Directory -Force -Path $sourceObjectRoot, $embindObjectRoot | Out-Null

$commonFlags = @(
    '-O2', '-DNDEBUG', '-DHAVE_CONFIG_H', '-DDISABLE_DXF', '-DDISABLE_JSON',
    '-DDISABLE_WRITE', '-sUSE_ZLIB=1',
    ('-I' + (Join-Path $sourceRoot 'src')),
    ('-I' + (Join-Path $sourceRoot 'include')),
    ('-I' + (Join-Path $sourceRoot 'programs'))
)

$cSources = @(
    'bits', 'classes', 'codepages', 'common', 'decode_r11', 'decode_r2007',
    'decode', 'decode2', 'dwg_api', 'dwg', 'dynapi', 'free', 'geom', 'hash',
    'logging', 'objects', 'print', 'reedsolomon'
)

$objects = [System.Collections.Generic.List[string]]::new()
foreach ($name in $cSources) {
    $inputFile = Join-Path $sourceRoot "src/$name.c"
    $outputFile = Join-Path $sourceObjectRoot "$name.o"
    & emcc @commonFlags -c $inputFile -o $outputFile
    if ($LASTEXITCODE -ne 0) { throw "Compilation failed: $inputFile" }
    $objects.Add($outputFile)
}

$cppFlags = @($commonFlags + '-std=c++17')
$embindSources = @('binding_common', 'binding_dynapi', 'binding_ent', 'binding_enum', 'binding_func')
foreach ($name in $embindSources) {
    $inputFile = Join-Path $sourceRoot "embind/$name.cpp"
    $outputFile = Join-Path $embindObjectRoot "$name.o"
    & emcc @cppFlags -c $inputFile -o $outputFile
    if ($LASTEXITCODE -ne 0) { throw "Compilation failed: $inputFile" }
    $objects.Add($outputFile)
}

$outputJavaScript = Join-Path $resolvedOutput 'libredwg-web.js'
$linkFlags = @(
    '-O2', '-lembind', '-std=c++17', '-sUSE_ZLIB=1',
    '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=1GB', '-sMAXIMUM_MEMORY=4GB',
    '-sMALLOC=mimalloc', '-sEXPORT_ES6=1', '-sMODULARIZE=1',
    '-sEXPORT_NAME=createModule',
    '-sEXPORTED_RUNTIME_METHODS=FS,ENV,ccall,cwrap,UTF8ToString,stringToNewUTF8,setValue'
)

& emcc @objects @linkFlags -o $outputJavaScript
if ($LASTEXITCODE -ne 0) { throw 'WebAssembly link failed.' }

Get-FileHash -Algorithm SHA256 -LiteralPath $outputJavaScript, (Join-Path $resolvedOutput 'libredwg-web.wasm')
