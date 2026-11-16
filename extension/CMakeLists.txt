cmake_minimum_required(VERSION 3.20)

project(csgo-nametag-tool-extension)

set(CMAKE_CXX_STANDARD 23)

add_library(csgo-nametag-tool-extension SHARED
	src/main.cpp
	src/platform.cpp
)

set_target_properties(csgo-nametag-tool-extension PROPERTIES
	PREFIX ""
)

target_compile_features(csgo-nametag-tool-extension PUBLIC
	cxx_std_26
)

target_include_directories(csgo-nametag-tool-extension PUBLIC
	src/steam
)

target_compile_definitions(csgo-nametag-tool-extension PUBLIC
	$<$<CONFIG:Debug>:DEBUG>
	$<$<CONFIG:Release>:RELEASE>
)
