declare i8* @__cxa_allocate_exception(i64)
declare void @__cxa_throw(i8*, i8*, i8*)
declare i8* @__cxa_begin_catch(i8*)
declare void @__cxa_end_catch()

declare i32 @__gxx_personality_v0(...)

declare i32 @llvm.eh.typeid.for(i8*) nounwind readnone
