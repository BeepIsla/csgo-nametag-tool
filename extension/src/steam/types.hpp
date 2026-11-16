#pragma once

#include <cstdint>

#if defined(__linux__) || defined(__APPLE__) || defined(__FreeBSD__)
#define VALVE_CALLBACK_PACK_SMALL
#else
#define VALVE_CALLBACK_PACK_LARGE
#endif

#if !defined(VALVE_BIG_ENDIAN)
#if defined(__GNUC__) && __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
#define VALVE_BIG_ENDIAN 1
#endif
#endif

#if defined(_WIN32) && defined(__GNUC__) && !defined(_S4N_)
#define STEAMWORKS_STRUCT_RETURN_0(returnType, functionName) \
	virtual void      functionName(returnType &ret) = 0;     \
	inline returnType functionName()                         \
	{                                                        \
		returnType ret;                                      \
		this->functionName(ret);                             \
		return ret;                                          \
	}
#else
#define STEAMWORKS_STRUCT_RETURN_0(returnType, functionName) virtual returnType functionName() = 0;
#endif

using HSteamPipe        = int32_t;
using HSteamUser        = int32_t;
using HSharedConnection = uint32_t;

using EAccountType          = int;
using EUniverse             = int;
using ENotificationPosition = int;
using ELogonState           = int;

using SteamAPICall_t               = uint64_t;
using SteamAPIWarningMessageHook_t = void *;

using unknown_ret = int;

class SteamIPAddress_t;
class IConCommandBaseAccessor;

#if defined(VALVE_CALLBACK_PACK_SMALL)
#pragma pack(push, 4)
#elif defined(VALVE_CALLBACK_PACK_LARGE)
#pragma pack(push, 8)
#else
#error Missing VALVE_CALLBACK_PACK_xxx
#endif

struct CallbackMsg_t
{
	HSteamUser m_hSteamUser;
	int32_t    m_iCallback;
	uint8_t   *m_pubParam;
	int32_t    m_cubParam;
};
#pragma pack(pop)

using CreateInterfaceFn           = void *(*)(const char *, int *);
using Steam_CreateSteamPipeFn     = HSteamPipe (*)();
using Steam_BReleaseSteamPipeFn   = void (*)(HSteamPipe);
using Steam_ConnectToGlobalUserFn = HSteamUser (*)(HSteamPipe);
using Steam_ReleaseUserFn         = void (*)(HSteamPipe, HSteamUser);
using Steam_BGetCallbackFn        = bool (*)(HSteamPipe hSteamPipe, CallbackMsg_t *pCallbackMsg);
using Steam_FreeLastCallbackFn    = void (*)(HSteamPipe hSteamPipe);

class CSteamID
{
public:
	union SteamID_t
	{
		struct SteamIDComponent_t
		{
#ifdef VALVE_BIG_ENDIAN
			EUniverse m_EUniverse : 8;
			uint32_t  m_EAccountType : 4;
			uint32_t  m_unAccountInstance : 20;
			uint32_t  m_unAccountID : 32;
#else
			uint32_t  m_unAccountID : 32;
			uint32_t  m_unAccountInstance : 20;
			uint32_t  m_EAccountType : 4;
			EUniverse m_EUniverse : 8;
#endif
		} m_comp;
		uint64_t m_unAll64Bits;
	} m_steamid;
};
static_assert(sizeof(CSteamID) == 8);

constexpr uint32_t k_EMsgClientFromGC = 5453;
