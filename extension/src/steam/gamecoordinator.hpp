#pragma once

#include <cstdint>

// Thanks Microsoft
#ifdef SendMessage
#undef SendMessage
#endif

enum EGCResults
{
	k_EGCResultOK             = 0,
	k_EGCResultNoMessage      = 1,
	k_EGCResultBufferTooSmall = 2,
	k_EGCResultNotLoggedOn    = 3,
	k_EGCResultInvalidMessage = 4
};

class IClientGameCoordinator
{
public:
	virtual EGCResults SendMessage(uint32_t unAppID, uint32_t unMsgType, const void *pubData, uint32_t cubData)                        = 0;
	virtual bool       IsMessageAvailable(uint32_t unAppID, uint32_t *pcubMsgSize)                                                     = 0;
	virtual EGCResults RetrieveMessage(uint32_t unAppID, uint32_t *punMsgType, void *pubDest, uint32_t cubDest, uint32_t *pcubMsgSize) = 0;
};
