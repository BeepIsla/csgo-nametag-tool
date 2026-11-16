#include "library.hpp"
#include "platform.hpp"
#include "steam/engine.hpp"
#include "steam/gamecoordinator.hpp"
#include "steam/sharedconnection.hpp"
#include "steam/types.hpp"
#include "steam/user.hpp"
#include <filesystem>
#include <print>

#ifdef _WIN32
#include <Windows.h>
#else
#include <dlfcn.h>
#endif

// Thanks Microsoft
#ifdef SendMessage
#undef SendMessage
#endif

struct SteamClient
{
	Library                     lib;
	Steam_CreateSteamPipeFn     Steam_CreateSteamPipe     = nullptr;
	Steam_ConnectToGlobalUserFn Steam_ConnectToGlobalUser = nullptr;
	Steam_ReleaseUserFn         Steam_ReleaseUser         = nullptr;
	Steam_BReleaseSteamPipeFn   Steam_BReleaseSteamPipe   = nullptr;
	Steam_BGetCallbackFn        Steam_BGetCallback        = nullptr;
	Steam_FreeLastCallbackFn    Steam_FreeLastCallback    = nullptr;

	bool Load(const char *steamclientPath)
	{
		if (!lib.Open(steamclientPath))
			return false;

		Steam_CreateSteamPipe     = lib.Get<Steam_CreateSteamPipeFn>("Steam_CreateSteamPipe");
		Steam_ConnectToGlobalUser = lib.Get<Steam_ConnectToGlobalUserFn>("Steam_ConnectToGlobalUser");
		Steam_ReleaseUser         = lib.Get<Steam_ReleaseUserFn>("Steam_ReleaseUser");
		Steam_BReleaseSteamPipe   = lib.Get<Steam_BReleaseSteamPipeFn>("Steam_BReleaseSteamPipe");
		Steam_BGetCallback        = lib.Get<Steam_BGetCallbackFn>("Steam_BGetCallback");
		Steam_FreeLastCallback    = lib.Get<Steam_FreeLastCallbackFn>("Steam_FreeLastCallback");

		return Steam_CreateSteamPipe &&
		       Steam_ConnectToGlobalUser &&
		       Steam_ReleaseUser &&
		       Steam_BReleaseSteamPipe &&
		       Steam_BGetCallback &&
		       Steam_FreeLastCallback;
	}

	void Close()
	{
		lib.Close();
		Steam_CreateSteamPipe     = nullptr;
		Steam_ConnectToGlobalUser = nullptr;
		Steam_ReleaseUser         = nullptr;
		Steam_BReleaseSteamPipe   = nullptr;
		Steam_BGetCallback        = nullptr;
		Steam_FreeLastCallback    = nullptr;
	}
} g_steamclient;

struct SteamData
{
	HSteamUser user = 0;
	HSteamPipe pipe = 0;

	IClientEngine           *clientEngine           = nullptr;
	IClientUser             *clientUser             = nullptr;
	IClientGameCoordinator  *clientGameCoordinator  = nullptr;
	IClientSharedConnection *clientSharedConnection = nullptr;

	HSharedConnection sharedConnection = 0;
	CUtlBuffer        sharedBuffer;

	bool Load()
	{
		pipe = g_steamclient.Steam_CreateSteamPipe();
		user = g_steamclient.Steam_ConnectToGlobalUser(pipe);
		if (!pipe || !user)
			return false;

		clientEngine = g_steamclient.lib.CreateInterface<IClientEngine *>(CLIENTENGINE_INTERFACE_VERSION);
		if (!clientEngine)
			return false;

		clientUser             = clientEngine->GetIClientUser(user, pipe);
		clientGameCoordinator  = clientEngine->GetIClientGameCoordinator(user, pipe);
		clientSharedConnection = clientEngine->GetIClientSharedConnection(user, pipe);
		if (!clientUser || !clientGameCoordinator || !clientSharedConnection)
			return false;

		sharedConnection = clientSharedConnection->AllocateSharedConnection();
		if (!sharedConnection)
			return false;

		// Hopefully 1 MB is always enough
		constexpr int size = 1 * 1024 * 1024;

		sharedBuffer.m_Memory.m_pMemory          = new uint8_t[size];
		sharedBuffer.m_Memory.m_nAllocationCount = size;
		sharedBuffer.m_Memory.m_nGrowSize        = -1; // Marks the buffer as external so Steam won't free it
		sharedBuffer.m_nMaxPut                   = size;

		return true;
	}

	void Close()
	{
		if (clientSharedConnection)
			clientSharedConnection->ReleaseSharedConnection(sharedConnection);
		if (g_steamclient.Steam_ReleaseUser)
			g_steamclient.Steam_ReleaseUser(pipe, user);
		if (g_steamclient.Steam_BReleaseSteamPipe)
			g_steamclient.Steam_BReleaseSteamPipe(pipe);
		if (sharedBuffer.m_Memory.m_pMemory)
			delete[] sharedBuffer.m_Memory.m_pMemory;

		user                   = 0;
		pipe                   = 0;
		clientEngine           = nullptr;
		clientUser             = nullptr;
		clientGameCoordinator  = nullptr;
		clientSharedConnection = nullptr;
		sharedConnection       = 0;
	}
} g_steamData;

bool InitImpl(const std::filesystem::path &installPath)
{
#ifdef _WIN32
	std::filesystem::path steamclientPath = installPath / "steamclient64.dll";
#else
	std::filesystem::path steamclientPath = installPath / "linux64" / "steamclient.so";
#endif
	if (!g_steamclient.Load(steamclientPath.string().c_str()))
	{
		std::println("Failed to load steamclient");
		return false;
	}

	if (!g_steamData.Load())
	{
		std::println("Failed to initialise Steam data");
		return false;
	}

	g_steamData.clientSharedConnection->RegisterEMsgHandler(g_steamData.sharedConnection, k_EMsgClientFromGC);
	return true;
}

EXPORT void Close();

EXPORT bool Init(const char *userProvidedInstallPath)
{
	if (g_steamclient.lib.IsOpen())
		return true;

	if (userProvidedInstallPath)
	{
		bool ret = InitImpl(userProvidedInstallPath);
		if (!ret)
			Close();
		return ret;
	}

	if (auto installPath = Platform::GetSteamInstallPath())
	{
		bool ret = InitImpl(installPath.value());
		if (!ret)
			Close();
		return ret;
	}

	return false;
}

EXPORT void Close()
{
	g_steamData.Close();
	g_steamclient.Close();
}

EXPORT bool GCSendMessage(uint32_t appID, uint32_t msgType, const void *data, uint32_t size)
{
	if (!g_steamData.clientGameCoordinator)
		return false;

	EGCResults result = g_steamData.clientGameCoordinator->SendMessage(appID, msgType, data, size);
	return result == k_EGCResultOK;
}

using RetrieveMessageCallback_t = void (*)(const uint8_t *, uint32_t);
EXPORT bool RetrieveMessage(RetrieveMessageCallback_t callback)
{
	if (!callback || !g_steamData.clientSharedConnection || !g_steamData.sharedConnection)
		return false;

	// We don't need this but pumping callbacks is probably for the better
	CallbackMsg_t steamCallback;
	while (g_steamclient.Steam_BGetCallback(g_steamData.pipe, &steamCallback))
		g_steamclient.Steam_FreeLastCallback(g_steamData.pipe);


	// Using IClientGameCoordinator::RetrieveMessage results in a race condition where the game tries to receive the data and
	// we try to receive the data at the same time, whoever is first wins and gets the data

	g_steamData.sharedBuffer.m_Put = 0;
	uint32_t call                  = 0;
	if (!g_steamData.clientSharedConnection->BPopReceivedMessage(g_steamData.sharedConnection, &g_steamData.sharedBuffer, &call))
		return false;

	callback(g_steamData.sharedBuffer.m_Memory.m_pMemory, g_steamData.sharedBuffer.m_Put);
	return true;
}

EXPORT uint64_t GetSteamID()
{
	if (!g_steamData.clientUser)
		return 0;
	return g_steamData.clientUser->GetSteamID().m_steamid.m_unAll64Bits;
}
