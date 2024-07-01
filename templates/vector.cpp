
#include <vector>
#include <cstdint>

using namespace std;

#ifndef ELEM_TYPE
#error ELEM_TYPE not defined
#endif
#ifndef TYPE_EXT
#error TYPE_EXT not defined
#endif

#define FUNC_EXT_I2(name, ext) name##_##ext
#define FUNC_EXT_I1(name, ext) FUNC_EXT_I2(name, ext)
#define FUNC_EXT(name) FUNC_EXT_I1(name, TYPE_EXT)

typedef ELEM_TYPE T;

extern "C" {

vector<T>* FUNC_EXT(create_vector)() {
    return new vector<T>();
}

vector<T>* FUNC_EXT(create_sized_vector)(size_t size) {
    return new vector<T>(size);
}

void FUNC_EXT(push_back)(vector<T>* v, T value) {
    v->push_back(value);
}

T FUNC_EXT(get)(vector<T>* v, size_t index) {
    return (*v)[index];
}

void FUNC_EXT(set)(vector<T>* v, size_t index, T value) {
    (*v)[index] = value;
}

size_t FUNC_EXT(size)(vector<T>* v) {
    return v->size();
}

}
